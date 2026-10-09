import { Component, OnInit, OnDestroy, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DeliveryApiService } from '../../services/delivery-api.service.js';
import { Order, OptimizationResult, ProposedTask } from '../../models/delivery.models.js';
import * as L from 'leaflet';

@Component({
  selector: 'app-dispatcher',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="min-h-screen bg-slate-50 text-slate-800 pb-12">
      <!-- Navbar -->
      <header class="bg-gradient-to-r from-orange-600 to-amber-600 text-white shadow-lg sticky top-0 z-30">
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div class="flex items-center space-x-3">
            <span class="text-2xl">🍱</span>
            <div>
              <h1 class="text-lg font-bold leading-tight">ระบบจัดเส้นทางและแบ่งงานไรเดอร์อัจฉริยะ</h1>
              <p class="text-xs text-orange-100">ร้านข้าวกล่องเดลิเวอรี ส่งด่วนมื้อเที่ยง (ม.มหาสารคาม ขามเรียง)</p>
            </div>
          </div>
          <div class="flex items-center space-x-2">
            <a href="/rider" target="_blank" class="px-3 py-1.5 text-xs font-semibold bg-white/20 hover:bg-white/30 rounded-lg transition">
              🛵 หน้าจอไรเดอร์ (มือถือ) ↗
            </a>
          </div>
        </div>
      </header>

      <main class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-6">
        <!-- Error Banner หาก Backend หรือ Database มีปัญหา -->
        @if (apiError()) {
          <div class="mb-6 p-4 bg-red-50 border border-red-200 text-red-800 rounded-xl shadow-sm flex items-start gap-3">
            <span class="text-2xl">⚠️</span>
            <div class="flex-1">
              <h3 class="font-bold text-sm text-red-900">เกิดข้อผิดพลาดในการเชื่อมต่อ Database ของ Backend</h3>
              <p class="text-xs text-red-700 mt-1">
                Backend ส่ง Error กลับมา: <span class="font-mono bg-red-100 px-1 py-0.5 rounded">{{ apiError() }}</span>
              </p>
              <p class="text-xs text-red-600 mt-1">
                💡 คำแนะนำ: หาก Deploy บน Railway กรุณาไปที่แท็บ <strong>Variables</strong> แล้วเพิ่ม <code>DATABASE_URL</code> ของ MySQL
              </p>
            </div>
            <button (click)="loadOrders()" class="text-xs px-3 py-1.5 bg-red-600 text-white font-medium rounded-lg hover:bg-red-700 transition">
              ลองใหม่
            </button>
          </div>
        }

        <!-- Action Toolbar -->
        <div class="bg-white rounded-xl shadow-sm border border-slate-200 p-4 mb-6 flex flex-wrap items-center justify-between gap-4">
          <div class="flex items-center space-x-3">
            <button 
              (click)="seedOrders()" 
              [disabled]="loading()"
              class="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white text-sm font-medium rounded-lg shadow transition flex items-center gap-2">
              <span>🎲</span> จำลอง 22 ออเดอร์ (รอบ มมส.)
            </button>
            <button 
              (click)="runOptimization()" 
              [disabled]="loading() || pendingCount() === 0"
              class="px-5 py-2 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white text-sm font-semibold rounded-lg shadow-md transition flex items-center gap-2 disabled:opacity-50">
              <span>⚡</span> คำนวณจัดเส้นทางอัตโนมัติ (VRP)
            </button>
            <button 
              (click)="clearAll()" 
              [disabled]="loading()"
              class="px-3 py-2 text-slate-500 hover:text-red-600 hover:bg-red-50 text-sm font-medium rounded-lg transition">
              ล้างข้อมูล
            </button>
          </div>

          <div class="flex items-center space-x-4 text-xs">
            <span class="px-3 py-1 bg-amber-100 text-amber-800 font-semibold rounded-full">
              รอจัดสรร: {{ pendingCount() }} รายการ
            </span>
            <span class="px-3 py-1 bg-blue-100 text-blue-800 font-semibold rounded-full">
              เวลาออกส่ง: 11:30 น.
            </span>
            <span class="px-3 py-1 bg-emerald-100 text-emerald-800 font-semibold rounded-full">
              เส้นตายส่งถึง: 12:30 น.
            </span>
          </div>
        </div>

        <!-- Financial KPI Dashboard (เมื่อคำนวณแล้ว) -->
        @if (optimizationData()) {
          <div class="grid grid-cols-2 md:grid-cols-6 gap-3 mb-6">
            <div class="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
              <span class="text-xs text-slate-500 block">รายได้รวม (65 บ./กล่อง)</span>
              <span class="text-xl font-bold text-slate-800">{{ optimizationData()!.summary.totalRevenue | number:'1.0-0' }} ฿</span>
              <span class="text-xs text-slate-400 block mt-1">{{ optimizationData()!.summary.totalBoxes }} กล่อง</span>
            </div>
            <div class="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
              <span class="text-xs text-slate-500 block">ต้นทุนอาหาร (40 บ./กล่อง)</span>
              <span class="text-xl font-bold text-slate-600">{{ optimizationData()!.summary.totalFoodCost | number:'1.0-0' }} ฿</span>
              <span class="text-xs text-slate-400 block mt-1">กำไรขั้นต้น {{ optimizationData()!.summary.totalRevenue - optimizationData()!.summary.totalFoodCost }} ฿</span>
            </div>
            <div class="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
              <span class="text-xs text-slate-500 block">ค่าจ้างไรเดอร์รวม</span>
              <span class="text-xl font-bold text-orange-600">{{ optimizationData()!.summary.totalRiderFee | number:'1.0-0' }} ฿</span>
              <span class="text-xs text-slate-400 block mt-1">สูตร: 15 + 2×กม.×กล่อง</span>
            </div>
            <div class="bg-white p-4 rounded-xl border border-emerald-200 bg-emerald-50/50 shadow-sm">
              <span class="text-xs text-emerald-700 font-medium block">กำไรสุทธิทางร้าน</span>
              <span class="text-xl font-extrabold text-emerald-700">+{{ optimizationData()!.summary.netProfit | number:'1.0-0' }} ฿</span>
              <span class="text-xs text-emerald-600 block mt-1">หลังหักค่าส่งทุกรอบ</span>
            </div>
            <div class="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
              <span class="text-xs text-slate-500 block">ไรเดอร์ / ใบงาน</span>
              <span class="text-xl font-bold text-blue-600">{{ optimizationData()!.summary.totalTasks }} คัน</span>
              <span class="text-xs text-slate-400 block mt-1">ระยะทางรวม {{ optimizationData()!.summary.totalDistanceKm }} กม.</span>
            </div>
            <div class="p-4 rounded-xl border shadow-sm" [ngClass]="optimizationData()!.summary.allDeliveredOnTime ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-200'">
              <span class="text-xs font-semibold block" [ngClass]="optimizationData()!.summary.allDeliveredOnTime ? 'text-emerald-800' : 'text-red-800'">สถานะเวลาส่ง</span>
              <span class="text-lg font-bold block mt-0.5" [ngClass]="optimizationData()!.summary.allDeliveredOnTime ? 'text-emerald-700' : 'text-red-700'">
                {{ optimizationData()!.summary.allDeliveredOnTime ? '✓ ทันทุกคัน' : '⚠ มีรอบเกินเวลา' }}
              </span>
              <span class="text-xs text-slate-500 block">ไม่เกิน 12:30 น. แน่นอน</span>
            </div>
          </div>
        }

        <!-- Main Content Grid: Map + Tasks -->
        <div class="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <!-- Left: Big Leaflet Map -->
          <div class="lg:col-span-7 bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
            <div class="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <h2 class="font-bold text-sm text-slate-700 flex items-center gap-2">
                <span>🗺️</span> แผนที่เส้นทางจัดส่งแยกตามสีไรเดอร์ (Mahasarakham University)
              </h2>
              <span class="text-xs text-slate-400">รัศมี 3 กม.</span>
            </div>
            <div id="dispatch-map" class="w-full h-[540px]"></div>
          </div>

          <!-- Right: Tasks & Confirmation -->
          <div class="lg:col-span-5 flex flex-col space-y-4">
            @if (optimizationData()) {
              <div class="bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-xl p-4 shadow flex items-center justify-between">
                <div>
                  <h3 class="font-bold text-sm">ตรวจสอบเส้นทางเรียบร้อย</h3>
                  <p class="text-xs text-emerald-100">พร้อมปล่อยงานให้ไรเดอร์สแกน QR Code รับงาน</p>
                </div>
                <button 
                  (click)="confirmDispatch()" 
                  [disabled]="isConfirmed() || loading()"
                  class="px-4 py-2 bg-white text-emerald-800 hover:bg-emerald-50 text-xs font-bold rounded-lg shadow transition disabled:opacity-50">
                  {{ isConfirmed() ? '✓ ปล่อยงานแล้ว' : '🚀 ยืนยันปล่อยงาน' }}
                </button>
              </div>

              <!-- Task Cards Accordion -->
              <div class="space-y-3 max-h-[500px] overflow-y-auto pr-1">
                @for (task of optimizationData()!.tasks; track task.taskNumber; let idx = $index) {
                  <div class="bg-white rounded-xl border border-slate-200 shadow-sm p-4 hover:shadow-md transition">
                    <div class="flex items-center justify-between mb-2">
                      <div class="flex items-center space-x-2">
                        <span class="w-3.5 h-3.5 rounded-full inline-block" [style.background-color]="task.routeColor"></span>
                        <span class="font-bold text-sm text-slate-800">{{ task.taskNumber }}</span>
                        <span class="text-xs px-2 py-0.5 bg-slate-100 text-slate-600 rounded">คันที่ {{ idx + 1 }}</span>
                      </div>
                      <button (click)="openQrModal(task.taskNumber)" class="text-xs px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-lg transition flex items-center gap-1">
                        <span>📲</span> QR Code
                      </button>
                    </div>

                    <div class="grid grid-cols-4 gap-2 text-center py-2 bg-slate-50 rounded-lg text-xs mb-3">
                      <div>
                        <span class="text-slate-400 block">กล่องรวม</span>
                        <span class="font-bold text-slate-700">{{ task.totalBoxes }} กล่อง</span>
                      </div>
                      <div>
                        <span class="text-slate-400 block">ระยะทาง</span>
                        <span class="font-bold text-slate-700">{{ task.totalDistanceKm }} กม.</span>
                      </div>
                      <div>
                        <span class="text-slate-400 block">เวลาที่ใช้</span>
                        <span class="font-bold text-slate-700">{{ task.estimatedMinutes }} นาที</span>
                      </div>
                      <div>
                        <span class="text-slate-400 block">ค่าจ้างไรเดอร์</span>
                        <span class="font-bold text-orange-600">{{ task.deliveryFee }} ฿</span>
                      </div>
                    </div>

                    <!-- Stops Timeline -->
                    <div class="space-y-1.5 text-xs">
                      @for (stop of task.stops; track stop.orderId) {
                        <div class="flex items-center justify-between text-slate-600 bg-slate-50/50 px-2.5 py-1.5 rounded border border-slate-100">
                          <div class="flex items-center space-x-2">
                            <span class="w-5 h-5 rounded-full bg-slate-200 text-slate-700 font-bold flex items-center justify-center text-[10px]">
                              {{ stop.stopSequence }}
                            </span>
                            <span class="font-medium text-slate-800 truncate max-w-[150px]">{{ stop.customerName }}</span>
                          </div>
                          <div class="flex items-center space-x-2">
                            <span class="text-orange-600 font-semibold">{{ stop.boxAmount }} กล่อง</span>
                            <span class="text-slate-400">🕒 {{ stop.estArrival }} น.</span>
                          </div>
                        </div>
                      }
                    </div>
                  </div>
                }
              </div>
            } @else {
              <!-- Empty state before optimize -->
              <div class="bg-white rounded-xl border border-slate-200 p-8 text-center flex flex-col items-center justify-center h-full min-h-[400px]">
                <span class="text-5xl mb-3">🛵</span>
                <h3 class="font-bold text-slate-700 mb-1">ยังไม่ได้คำนวณจัดเส้นทาง</h3>
                <p class="text-xs text-slate-400 max-w-sm mb-4">
                  กดปุ่ม "จำลอง 22 ออเดอร์" เพื่อสร้างรายการคำสั่งซื้อรอบมหาวิทยาลัยมหาสารคาม แล้วกด "คำนวณจัดเส้นทางอัตโนมัติ"
                </p>
                <button (click)="seedOrders()" class="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold rounded-lg shadow transition">
                  เริ่มจำลองออเดอร์ทันที
                </button>
              </div>
            }
          </div>
        </div>
      </main>

      <!-- QR Code Modal (แก้ z-index ให้สูงกว่า Leaflet map ที่มี z-index สูงสุด 1000) -->
      @if (activeQr()) {
        <div class="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" style="z-index: 99999;">
          <div class="bg-white rounded-2xl p-6 max-w-sm w-full text-center shadow-2xl animate-in fade-in duration-150 relative">
            <h3 class="font-bold text-base text-slate-800 mb-1">สแกนรับใบงานไรเดอร์</h3>
            <p class="text-xs text-slate-500 mb-4">{{ activeQr()!.taskNumber }}</p>
            <div class="bg-white p-3 border border-slate-200 rounded-xl inline-block mb-4 shadow-sm">
              <img [src]="activeQr()!.qrDataUrl" alt="Task QR Code" class="w-56 h-56 mx-auto object-contain" />
            </div>
            <p class="text-xs text-slate-400 mb-4">ไรเดอร์สามารถใช้กล้องมือถือสแกนเพื่อเปิดใบงานและเริ่มนำทางได้ทันที</p>
            <div class="flex gap-2">
              <a [href]="'/rider/' + activeQr()!.taskNumber" target="_blank" class="flex-1 py-2 bg-orange-500 hover:bg-orange-600 text-white font-medium text-xs rounded-lg transition">
                เปิดหน้าจำลองไรเดอร์
              </a>
              <button (click)="activeQr.set(null)" class="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium text-xs rounded-lg transition">
                ปิด
              </button>
            </div>
          </div>
        </div>
      }
    </div>
  `
})
export class DispatcherComponent implements OnInit, OnDestroy {
  private api = inject(DeliveryApiService);

  orders = signal<Order[]>([]);
  optimizationData = signal<OptimizationResult | null>(null);
  loading = signal<boolean>(false);
  isConfirmed = signal<boolean>(false);
  activeQr = signal<{ taskNumber: string; qrDataUrl: string } | null>(null);
  apiError = signal<string | null>(null);

  private map: L.Map | null = null;
  private routeLayers: L.LayerGroup = L.layerGroup();

  ngOnInit() {
    this.loadOrders();
    setTimeout(() => this.initMap(), 100);
  }

  ngOnDestroy() {
    if (this.map) {
      this.map.remove();
    }
  }

  pendingCount(): number {
    return this.orders().filter(o => o.status === 'PENDING').length;
  }

  loadOrders() {
    this.api.getOrders().subscribe({
      next: (data) => {
        this.orders.set(data);
        this.apiError.set(null);
      },
      error: (err) => {
        console.error('Error loading orders:', err);
        const errMsg = err.error?.error || err.message || 'ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ Backend ได้';
        this.apiError.set(errMsg);
      }
    });
  }

  seedOrders() {
    this.loading.set(true);
    this.api.seedMockOrders().subscribe({
      next: () => {
        this.loading.set(false);
        this.isConfirmed.set(false);
        this.optimizationData.set(null);
        this.loadOrders();
      },
      error: (err) => {
        this.loading.set(false);
        const errMsg = err.error?.error || err.message || 'ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้';
        alert(`เกิดข้อผิดพลาดในการจำลองออเดอร์: ${errMsg}`);
      }
    });
  }

  clearAll() {
    if (confirm('คุณต้องการล้างข้อมูลออเดอร์และใบงานทั้งหมดหรือไม่?')) {
      this.loading.set(true);
      this.api.clearOrders().subscribe({
        next: () => {
          this.loading.set(false);
          this.orders.set([]);
          this.optimizationData.set(null);
          this.routeLayers.clearLayers();
        },
        error: (err) => {
          this.loading.set(false);
          alert(`เกิดข้อผิดพลาดในการล้างข้อมูล: ${err.error?.error || err.message}`);
        }
      });
    }
  }

  runOptimization() {
    this.loading.set(true);
    this.api.optimizeRoutes().subscribe({
      next: (res) => {
        this.optimizationData.set(res);
        this.isConfirmed.set(false);
        this.loading.set(false);
        this.renderRoutesOnMap(res);
      },
      error: (err) => {
        alert(err.error?.error || 'เกิดข้อผิดพลาดในการคำนวณเส้นทาง');
        this.loading.set(false);
      }
    });
  }

  confirmDispatch() {
    const data = this.optimizationData();
    if (!data || this.loading()) return;

    this.loading.set(true);
    this.api.confirmTasks(data.tasks).subscribe({
      next: (response) => {
        // Confirmation is authoritative: the server recalculates values and
        // may allocate different task numbers after a concurrent dispatch.
        this.optimizationData.update((current) =>
          current ? { ...current, tasks: response.tasks } : null
        );
        this.isConfirmed.set(true);
        this.loading.set(false);
        alert('ยืนยันและปล่อยงานให้ไรเดอร์เรียบร้อย!');
        this.loadOrders();
      },
      error: (err) => {
        this.loading.set(false);
        alert(err.error?.error || 'ไม่สามารถยืนยันได้');
      }
    });
  }

  openQrModal(taskNumber: string) {
    this.api.getTaskQr(taskNumber).subscribe({
      next: (res) => this.activeQr.set(res),
      error: (err) => alert('ไม่สามารถสร้าง QR Code ได้')
    });
  }

  private initMap() {
    const hubLat = 16.246825;
    const hubLng = 103.252072;

    const mapContainer = document.getElementById('dispatch-map');
    if (!mapContainer) return;

    if (this.map) {
      this.map.remove();
      this.map = null;
    }
    (mapContainer as any)._leaflet_id = null;

    this.map = L.map('dispatch-map').setView([hubLat, hubLng], 14);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors'
    }).addTo(this.map);

    this.routeLayers = L.layerGroup().addTo(this.map);

    // ปักหมุดร้านค้า / Hub กลาง
    const hubIcon = L.divIcon({
      className: 'bg-orange-600 text-white rounded-full flex items-center justify-center font-bold shadow-lg border-2 border-white',
      html: '🍱',
      iconSize: [36, 36],
      iconAnchor: [18, 18]
    });

    L.marker([hubLat, hubLng], { icon: hubIcon })
      .bindPopup('<b>ร้านข้าวกล่องเดลิเวอรี ส่งด่วนมื้อเที่ยง (Hub)</b><br>เวลาออกส่ง: 11:30 น.')
      .addTo(this.map)
      .openPopup();
  }

  private renderRoutesOnMap(result: OptimizationResult) {
    if (!this.map) return;
    this.routeLayers.clearLayers();

    const bounds = L.latLngBounds([]);
    bounds.extend([result.hub.latitude, result.hub.longitude]);

    result.tasks.forEach((task) => {
      // 1. วาดเส้น Polyline ของ Task นี้
      const polyline = L.polyline(task.waypoints, {
        color: task.routeColor,
        weight: 4,
        opacity: 0.85,
        dashArray: '2, 4'
      });
      this.routeLayers.addLayer(polyline);

      // 2. ปักหมุดแต่ละจุดส่ง
      task.stops.forEach((stop) => {
        bounds.extend([stop.latitude, stop.longitude]);

        const markerIcon = L.divIcon({
          className: 'custom-leaflet-marker',
          html: `<div style="background-color: ${task.routeColor}; color: #ffffff; width:100%; height:100%; border-radius:9999px; display:flex; align-items:center; justify-content:center; font-weight:bold; font-size:12px; border:2px solid #ffffff; box-shadow:0 2px 4px rgba(0,0,0,0.3);">${stop.stopSequence}</div>`,
          iconSize: [28, 28],
          iconAnchor: [14, 14]
        });

        const marker = L.marker([stop.latitude, stop.longitude], { icon: markerIcon });
        marker.bindPopup(`
          <div style="font-size: 13px;">
            <b style="color: ${task.routeColor};">${task.taskNumber} (จุดที่ ${stop.stopSequence})</b><br/>
            <b>ผู้รับ:</b> ${stop.customerName}<br/>
            <b>โทร:</b> ${stop.customerPhone}<br/>
            <b>ที่อยู่:</b> ${stop.addressDetail}<br/>
            <b>จำนวน:</b> ${stop.boxAmount} กล่อง (${stop.itemPrice} บ.)<br/>
            <b>เวลาคาดหมาย:</b> ${stop.estArrival} น.<br/>
            <a href="${stop.navigationUrl}" target="_blank" style="color: #2563EB; font-weight: bold; text-decoration: underline;">เปิด Google Maps นำทาง ↗</a>
          </div>
        `);
        this.routeLayers.addLayer(marker);
      });
    });

    this.map.fitBounds(bounds, { padding: [40, 40] });
  }
}
