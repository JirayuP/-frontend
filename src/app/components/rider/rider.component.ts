import { Component, OnInit, OnDestroy, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { DeliveryApiService } from '../../services/delivery-api.service.js';
import { RiderTaskDetail } from '../../models/delivery.models.js';
import { Html5Qrcode } from 'html5-qrcode';

@Component({
  selector: 'app-rider',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  template: `
    <div class="min-h-screen bg-slate-900 text-slate-100 flex flex-col justify-between">
      <!-- Mobile Top Bar -->
      <header class="bg-slate-800 border-b border-slate-700 px-4 py-3.5 sticky top-0 z-20 flex items-center justify-between">
        <div class="flex items-center space-x-2">
          <span class="text-xl">🛵</span>
          <div>
            <h1 class="font-bold text-sm leading-tight text-white">ระบบใบงานไรเดอร์ (ส่งด่วนมื้อเที่ยง)</h1>
            <p class="text-[10px] text-slate-400">ร้านข้าวกล่องเดลิเวอรี ม.มหาสารคาม</p>
          </div>
        </div>
        <a routerLink="/" class="text-xs text-orange-400 font-medium hover:underline">
          หน้าจัดงาน ↗
        </a>
      </header>

      <!-- Main Container (Mobile Max Width) -->
      <main class="flex-1 max-w-md w-full mx-auto p-4 space-y-4">
        <!-- Search / Task Number Input & QR Scanner Button -->
        <div class="bg-slate-800 p-3.5 rounded-2xl border border-slate-700 shadow-lg">
          <label class="block text-xs text-slate-400 font-medium mb-1.5">ค้นหาหรือสแกนรหัสใบงาน</label>
          <div class="flex gap-2">
            <input 
              type="text" 
              [(ngModel)]="searchTaskNumber" 
              (keyup.enter)="loadTask(searchTaskNumber)"
              placeholder="เช่น TASK-20261008-01"
              class="flex-1 min-w-0 bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-orange-500 uppercase font-mono"
            />
            <button 
              (click)="loadTask(searchTaskNumber)"
              class="px-3.5 py-2 bg-orange-500 hover:bg-orange-600 active:scale-95 text-white font-bold text-xs rounded-xl shadow transition whitespace-nowrap">
              ค้นหา
            </button>
            <button 
              (click)="openQrScanner()"
              class="px-3.5 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 active:scale-95 text-white font-bold text-xs rounded-xl shadow transition flex items-center gap-1.5 whitespace-nowrap">
              <span>📷</span> สแกน QR
            </button>
          </div>
        </div>

        @if (task()) {
          <!-- Task Header Summary Card -->
          <div class="bg-gradient-to-br from-orange-600 to-amber-600 rounded-2xl p-5 shadow-xl text-white">
            <div class="flex justify-between items-start mb-2">
              <div>
                <span class="text-xs font-semibold px-2.5 py-0.5 bg-black/20 rounded-full">
                  {{ task()!.taskNumber }}
                </span>
                <h2 class="text-2xl font-black mt-2">
                  หยิบรวม {{ task()!.totalBoxes }} กล่อง
                </h2>
              </div>
              <div class="text-right">
                <span class="text-xs opacity-80 block">ค่าจ้างรอบนี้</span>
                <span class="text-2xl font-black text-amber-200">{{ task()!.deliveryFee }} ฿</span>
              </div>
            </div>

            <div class="grid grid-cols-3 gap-2 pt-3 mt-3 border-t border-white/20 text-center text-xs">
              <div>
                <span class="opacity-75 block text-[11px]">เวลาออกส่ง</span>
                <span class="font-bold">{{ task()!.departureTime }} น.</span>
              </div>
              <div>
                <span class="opacity-75 block text-[11px]">ระยะทางรวม</span>
                <span class="font-bold">{{ task()!.totalDistance }} กม.</span>
              </div>
              <div>
                <span class="opacity-75 block text-[11px]">จุดส่งทั้งหมด</span>
                <span class="font-bold">{{ task()!.totalStopsCount || task()!.stops.length }} จุด</span>
              </div>
            </div>

            <!-- Rider Check-in Status -->
            @if (!task()!.rider) {
              <div class="mt-4 pt-3 border-t border-white/20">
                <button 
                  (click)="showCheckinModal.set(true)"
                  class="w-full py-2.5 bg-slate-900 hover:bg-black active:scale-95 text-white font-bold text-xs rounded-xl shadow-lg transition flex items-center justify-center gap-1.5">
                  <span>✍️</span> กดที่นี่เพื่อลงชื่อรับใบงานนี้
                </button>
              </div>
            } @else {
              <div class="mt-3 pt-2 border-t border-white/20 text-xs text-amber-100 flex items-center justify-between">
                <span>ไรเดอร์: {{ task()!.rider!.name }} ({{ task()!.rider!.phone }})</span>
                <span class="text-[10px] bg-black/20 px-2 py-0.5 rounded font-semibold text-emerald-300">✓ รับงานแล้ว</span>
              </div>
            }
          </div>

          <!-- Step-by-Step Delivery Stops Timeline: แสดงเฉพาะเมื่อคนขับลงชื่อแล้วเท่านั้น -->
          @if (task()!.rider) {
            <div class="space-y-3 animate-in fade-in duration-200">
              <div class="flex items-center justify-between px-1">
                <h3 class="text-xs font-bold text-slate-400 uppercase tracking-wider">
                  ลำดับการจัดส่ง (เรียงตามเส้นทางที่สั้นที่สุด)
                </h3>
                <span class="text-[10px] text-emerald-400 font-semibold px-2 py-0.5 bg-emerald-950/60 border border-emerald-800/40 rounded-full">
                  กำลังปฏิบัติงาน
                </span>
              </div>

              @for (stop of task()!.stops; track stop.itemId) {
                <div 
                  class="rounded-2xl border p-4 transition shadow-md"
                  [ngClass]="stop.deliveryStatus === 'DELIVERED' ? 'bg-slate-800/50 border-emerald-500/40 opacity-75' : 'bg-slate-800 border-slate-700'">
                  
                  <div class="flex items-start justify-between mb-2">
                    <div class="flex items-center space-x-2.5">
                      <span 
                        class="w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs shadow"
                        [ngClass]="stop.deliveryStatus === 'DELIVERED' ? 'bg-emerald-500 text-white' : 'bg-orange-500 text-white'">
                        {{ stop.deliveryStatus === 'DELIVERED' ? '✓' : stop.stopSequence }}
                      </span>
                      <div>
                        <h4 class="font-bold text-sm text-white">{{ stop.customerName }}</h4>
                        <span class="text-xs text-orange-400 font-semibold">{{ stop.boxAmount }} กล่อง</span>
                      </div>
                    </div>
                    
                    <span class="text-xs font-medium text-slate-400">
                      🕒 ถึงเวลา {{ stop.estArrival }} น.
                    </span>
                  </div>

                  <p class="text-xs text-slate-300 bg-slate-900/60 p-2.5 rounded-xl border border-slate-700/50 mb-3">
                    📍 {{ stop.addressDetail }}
                  </p>

                  <!-- Actions: Call & Google Maps & Complete -->
                  <div class="grid grid-cols-2 gap-2 mb-2">
                    <a 
                      [href]="'tel:' + stop.customerPhone"
                      class="py-2.5 px-3 bg-slate-700 hover:bg-slate-600 active:scale-95 text-white font-medium text-xs rounded-xl flex items-center justify-center gap-1.5 transition">
                      <span>📞</span> โทรหาลูกค้า
                    </a>
                    <a 
                      [href]="stop.navigationUrl" 
                      target="_blank"
                      class="py-2.5 px-3 bg-blue-600 hover:bg-blue-500 active:scale-95 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 transition">
                      <span>🗺️</span> นำทาง Maps
                    </a>
                  </div>

                  @if (stop.deliveryStatus !== 'DELIVERED') {
                    <button 
                      (click)="confirmDelivery(stop.itemId)"
                      class="w-full py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 active:scale-95 text-white font-bold text-xs rounded-xl shadow-lg transition">
                      ✓ กดยืนยันส่งมอบจุดนี้สำเร็จ
                    </button>
                  } @else {
                    <div class="text-center py-1.5 text-xs text-emerald-400 font-bold bg-emerald-950/40 rounded-xl border border-emerald-800/40">
                      ✓ จัดส่งสำเร็จเรียบร้อยแล้ว
                    </div>
                  }
                </div>
              }
            </div>
          } @else {
            <!-- กรณีที่คนขับยังไม่ลงชื่อรับงาน: ล็อคและยังไม่แสดงจุดส่ง -->
            <div class="bg-slate-800/80 border border-slate-700/80 rounded-2xl p-6 text-center space-y-4 shadow-xl">
              <div class="w-14 h-14 bg-amber-500/10 border border-amber-500/20 text-amber-400 rounded-2xl flex items-center justify-center mx-auto text-2xl shadow-inner">
                🔒
              </div>
              <div class="space-y-1">
                <h3 class="font-bold text-base text-white">ยังไม่ได้ลงชื่อรับใบงาน</h3>
                <p class="text-xs text-slate-400 max-w-xs mx-auto leading-relaxed">
                  รายการจัดส่ง เบอร์โทรลูกค้า และเส้นทางนำทาง Google Maps จะแสดงเมื่อคุณลงชื่อรับใบงานนี้เรียบร้อยแล้ว
                </p>
              </div>
              <button 
                (click)="showCheckinModal.set(true)"
                class="w-full py-3 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 active:scale-95 text-white font-bold text-xs rounded-xl shadow-lg transition flex items-center justify-center gap-2">
                <span>✍️</span> ลงชื่อรับใบงานนี้เพื่อเริ่มส่ง
              </button>
            </div>
          }
        } @else if (loading()) {
          <div class="text-center py-12 text-slate-400 text-xs">
            กำลังโหลดข้อมูลใบงาน...
          </div>
        } @else {
          <div class="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-8 text-center text-slate-400 space-y-3 shadow-sm">
            <span class="text-4xl block mb-2">📋</span>
            <p class="text-sm font-bold text-white">พร้อมเริ่มรับใบงานแล้วหรือยัง?</p>
            <p class="text-xs text-slate-400 max-w-xs mx-auto leading-relaxed">
              สแกน QR Code จากหน้าจอร้านค้า หรือพิมพ์รหัสใบงานเพื่อเริ่มต้นงานส่งอาหาร
            </p>
            <div class="pt-2">
              <button 
                (click)="openQrScanner()"
                class="px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 active:scale-95 text-white font-bold text-xs rounded-xl shadow-lg transition inline-flex items-center gap-2">
                <span class="text-base">📷</span> เปิดกล้องสแกน QR Code ใบงาน
              </button>
            </div>
          </div>
        }
      </main>

      <!-- Rider Check-in Modal -->
      @if (showCheckinModal()) {
        <div class="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4" style="z-index: 99999;">
          <div class="bg-slate-800 border border-slate-700 rounded-2xl p-5 max-w-xs w-full shadow-2xl">
            <h3 class="font-bold text-base text-white mb-1">ลงชื่อรับใบงาน</h3>
            <p class="text-xs text-slate-400 mb-4">{{ task()!.taskNumber }}</p>

            <div class="space-y-3">
              <div>
                <label class="block text-xs text-slate-300 mb-1">ชื่อไรเดอร์</label>
                <input 
                  type="text" 
                  [(ngModel)]="riderName" 
                  placeholder="เช่น พี่ชัย" 
                  class="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-orange-500"
                />
              </div>
              <div>
                <label class="block text-xs text-slate-300 mb-1">เบอร์โทรศัพท์</label>
                <input 
                  type="tel" 
                  [(ngModel)]="riderPhone" 
                  placeholder="08X-XXX-XXXX" 
                  class="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-orange-500"
                />
              </div>
            </div>

            <div class="flex gap-2 mt-5">
              <button 
                (click)="submitCheckin()"
                class="flex-1 py-2.5 bg-orange-500 hover:bg-orange-600 text-white font-bold text-xs rounded-xl transition">
                ยืนยันรับงาน
              </button>
              <button 
                (click)="showCheckinModal.set(false)"
                class="px-4 py-2.5 bg-slate-700 hover:bg-slate-600 text-slate-300 font-medium text-xs rounded-xl transition">
                ยกเลิก
              </button>
            </div>
          </div>
        </div>
      }

      <!-- QR Scanner Modal -->
      @if (showScannerModal()) {
        <div class="fixed inset-0 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200" style="z-index: 99999;">
          <div class="bg-slate-800 border border-slate-700 rounded-3xl p-5 max-w-sm w-full shadow-2xl space-y-4">
            <div class="flex items-center justify-between pb-3 border-b border-slate-700/60">
              <div class="flex items-center space-x-2">
                <span class="text-xl">📷</span>
                <h3 class="font-bold text-base text-white">สแกน QR Code ใบงาน</h3>
              </div>
              <button 
                (click)="closeQrScanner()"
                class="w-8 h-8 rounded-full bg-slate-700/60 hover:bg-slate-700 text-slate-300 flex items-center justify-center text-sm font-bold transition">
                ✕
              </button>
            </div>

            <!-- Viewfinder Area for Camera -->
            <div class="relative rounded-2xl overflow-hidden bg-black aspect-square flex items-center justify-center border border-slate-700">
              <div id="qr-reader" class="w-full h-full"></div>

              @if (scannerError()) {
                <div class="absolute inset-0 bg-slate-900/95 flex flex-col items-center justify-center p-5 text-center space-y-3">
                  <span class="text-3xl text-amber-400">⚠️</span>
                  <p class="text-xs text-slate-300 font-medium leading-relaxed">{{ scannerError() }}</p>
                  <label class="px-4 py-2.5 bg-blue-600 hover:bg-blue-500 active:scale-95 text-white font-bold text-xs rounded-xl cursor-pointer shadow-lg transition inline-flex items-center gap-2">
                    <span>📁</span> เลือกรูป QR Code จากเครื่อง
                    <input type="file" accept="image/*" (change)="onFileScan($event)" class="hidden" />
                  </label>
                </div>
              }
            </div>

            <div class="space-y-2 text-center">
              <p class="text-[11px] text-slate-400">
                นำกล้องมือถือส่องไปที่ QR Code บนหน้าจอร้านค้า
              </p>

              <div class="pt-2 border-t border-slate-700/60 flex items-center justify-between text-xs text-slate-400">
                <span>หรืออัปโหลดรูปภาพ:</span>
                <label class="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 active:scale-95 text-white font-medium text-xs rounded-lg cursor-pointer transition flex items-center gap-1.5">
                  <span>📁</span> เลือกรูป QR
                  <input type="file" accept="image/*" (change)="onFileScan($event)" class="hidden" />
                </label>
              </div>
            </div>

            <button 
              (click)="closeQrScanner()"
              class="w-full py-2.5 bg-slate-700/80 hover:bg-slate-700 text-slate-300 font-medium text-xs rounded-xl transition">
              ปิดหน้าต่าง
            </button>
          </div>
        </div>
      }

      <!-- Invisible container for decoding QR from image files -->
      <div id="qr-reader-file-dummy" class="hidden"></div>

      <footer class="text-center py-4 text-[10px] text-slate-600">
        Smart Lunch Delivery System &copy; 2026 Mahasarakham
      </footer>
    </div>
  `
})
export class RiderComponent implements OnInit, OnDestroy {
  private api = inject(DeliveryApiService);
  private route = inject(ActivatedRoute);

  searchTaskNumber = '';
  task = signal<RiderTaskDetail | null>(null);
  loading = signal<boolean>(false);
  showCheckinModal = signal<boolean>(false);

  // Scanner state
  showScannerModal = signal<boolean>(false);
  scannerError = signal<string | null>(null);
  private html5QrCode: Html5Qrcode | null = null;

  riderName = '';
  riderPhone = '';

  ngOnInit() {
    this.route.params.subscribe(params => {
      const taskNum = params['taskNumber'];
      if (taskNum) {
        this.searchTaskNumber = taskNum;
        this.loadTask(taskNum);
      }
    });
  }

  ngOnDestroy() {
    this.stopCameraScanner();
  }

  loadTask(taskNumber: string) {
    if (!taskNumber) return;
    this.loading.set(true);
    this.api.getTaskByNumber(taskNumber.trim().toUpperCase()).subscribe({
      next: (data) => {
        this.task.set(data);
        this.loading.set(false);
      },
      error: (err) => {
        alert(err.error?.error || 'ไม่พบใบงานนี้');
        this.loading.set(false);
      }
    });
  }

  confirmDelivery(itemId: number) {
    const currentTask = this.task();
    if (!currentTask) return;

    this.api.completeStop(currentTask.taskNumber, itemId).subscribe({
      next: (res) => {
        // อัปเดตสถานะในหน้าจอ
        this.task.update(t => {
          if (!t) return null;
          return {
            ...t,
            status: res.isTaskCompleted ? 'DELIVERED' : t.status,
            stops: t.stops.map(s => s.itemId === itemId ? { ...s, deliveryStatus: 'DELIVERED' } : s)
          };
        });
        if (res.isTaskCompleted) {
          alert('🎉 เยี่ยมมาก! คุณจัดส่งครบทุกจุดในใบงานนี้แล้ว');
        }
      },
      error: (err) => alert(err.error?.error || 'เกิดข้อผิดพลาดในการบันทึก')
    });
  }

  submitCheckin() {
    if (!this.riderName || !this.riderPhone) {
      alert('กรุณากรอกชื่อและเบอร์โทร');
      return;
    }
    const currentTask = this.task();
    if (!currentTask) return;

    this.api.riderCheckIn(currentTask.taskNumber, {
      riderName: this.riderName,
      riderPhone: this.riderPhone
    }).subscribe({
      next: () => {
        this.showCheckinModal.set(false);
        this.loadTask(currentTask.taskNumber);
      },
      error: (err) => alert(err.error?.error || 'ไม่สามารถลงชื่อได้')
    });
  }

  // ===================== QR Scanner Methods =====================

  openQrScanner() {
    this.showScannerModal.set(true);
    this.scannerError.set(null);
    setTimeout(() => {
      this.startCameraScanner();
    }, 250);
  }

  async startCameraScanner() {
    try {
      const container = document.getElementById('qr-reader');
      if (!container) return;

      this.html5QrCode = new Html5Qrcode('qr-reader');
      const config = { 
        fps: 10, 
        qrbox: { width: 220, height: 220 },
        aspectRatio: 1.0
      };

      await this.html5QrCode.start(
        { facingMode: 'environment' },
        config,
        (decodedText: string) => {
          this.handleQrScanSuccess(decodedText);
        },
        () => {} // scan attempt without qr
      );
    } catch (err: any) {
      console.warn('Camera start failed', err);
      this.scannerError.set('ไม่สามารถเปิดกล้องได้ (โปรดตรวจสอบสิทธิ์การใช้งานกล้อง หรือใช้ปุ่มเลือกรูปภาพด้านล่าง)');
    }
  }

  async stopCameraScanner() {
    if (this.html5QrCode) {
      try {
        if (this.html5QrCode.isScanning) {
          await this.html5QrCode.stop();
        }
        this.html5QrCode.clear();
      } catch (e) {
        console.warn('Error stopping scanner', e);
      } finally {
        this.html5QrCode = null;
      }
    }
  }

  async closeQrScanner() {
    await this.stopCameraScanner();
    this.showScannerModal.set(false);
  }

  handleQrScanSuccess(decodedText: string) {
    this.closeQrScanner();

    // ถอดรหัส Task Number จาก URL หรือ Text:
    // เช่น "http://localhost:4200/rider/TASK-20261008-01" หรือ "TASK-20261008-01"
    let taskNum = decodedText.trim();
    const match = taskNum.match(/TASK-[\w-]+/i);
    if (match) {
      taskNum = match[0].toUpperCase();
    } else {
      const parts = taskNum.split('/');
      taskNum = parts[parts.length - 1].trim().toUpperCase();
    }

    if (taskNum) {
      this.searchTaskNumber = taskNum;
      this.loadTask(taskNum);
    }
  }

  async onFileScan(event: Event) {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;
    const file = input.files[0];

    try {
      await this.stopCameraScanner();
      const fileScanner = new Html5Qrcode('qr-reader-file-dummy');
      const decodedText = await fileScanner.scanFile(file, true);
      this.handleQrScanSuccess(decodedText);
    } catch (err) {
      alert('ไม่พบ QR Code ในรูปภาพที่เลือก กรุณาเลือกรูปภาพที่ชัดเจนอีกครั้ง');
    } finally {
      input.value = '';
    }
  }
}
