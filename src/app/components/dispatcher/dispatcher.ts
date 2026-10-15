import { Component, OnInit, OnDestroy, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DeliveryApiService } from '../../services/delivery-api.service.js';
import { OptimizationAlternative, Order, OptimizationResult } from '../../models/delivery.models.js';
import * as L from 'leaflet';

@Component({
  selector: 'app-dispatcher',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './dispatcher.html'
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
    this.reloadDashboard();
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

  reloadDashboard() {
    this.loadOrders();
    this.restoreTodayRoutes();
  }

  restoreTodayRoutes() {
    this.api.getTodayRoutes().subscribe({
      next: (result) => {
        if (result.tasks.length === 0) {
          if (this.isConfirmed()) this.optimizationData.set(null);
          this.isConfirmed.set(false);
          this.routeLayers.clearLayers();
          return;
        }

        this.optimizationData.set(result);
        this.isConfirmed.set(true);
        this.apiError.set(null);
        this.renderRoutesOnMap(result);
      },
      error: (err) => {
        const errMsg = err.error?.error || err.message || 'ไม่สามารถโหลดใบงานที่ปล่อยแล้วได้';
        this.apiError.set(errMsg);
      }
    });
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

  selectPlan(alternative: OptimizationAlternative) {
    const current = this.optimizationData();
    if (!current || this.isConfirmed()) return;

    const selected: OptimizationResult = {
      ...current,
      strategy: alternative.strategy,
      strategyLabel: alternative.label,
      summary: alternative.summary,
      tasks: alternative.tasks
    };
    this.optimizationData.set(selected);
    this.renderRoutesOnMap(selected);
  }

  confirmDispatch() {
    const data = this.optimizationData();
    if (!data || this.loading()) return;

    this.loading.set(true);
    this.api.confirmTasks(data.tasks, data.strategy).subscribe({
      next: (response) => {
        // Confirmation is authoritative: the server recalculates values and
        // may allocate different task numbers after a concurrent dispatch.
        this.optimizationData.set(response.result);
        this.isConfirmed.set(true);
        this.loading.set(false);
        this.renderRoutesOnMap(response.result);
        alert('ยืนยันและปล่อยงานให้ไรเดอร์เรียบร้อย!');
        this.loadOrders();
        this.restoreTodayRoutes();
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

  taskStatusLabel(status: string): string {
    const labels: Record<string, string> = {
      CONFIRMED: 'รอไรเดอร์รับ',
      IN_PROGRESS: 'กำลังจัดส่ง',
      DELIVERED: 'ส่งครบแล้ว',
      CANCELLED: 'ยกเลิก'
    };
    return labels[status] ?? status;
  }

  taskStatusClass(status: string): string {
    const classes: Record<string, string> = {
      CONFIRMED: 'bg-blue-100 text-blue-700',
      IN_PROGRESS: 'bg-amber-100 text-amber-700',
      DELIVERED: 'bg-emerald-100 text-emerald-700',
      CANCELLED: 'bg-red-100 text-red-700'
    };
    return classes[status] ?? 'bg-slate-100 text-slate-600';
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

    const currentResult = this.optimizationData();
    if (currentResult) this.renderRoutesOnMap(currentResult);
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
