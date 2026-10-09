import { Component, OnInit, OnDestroy, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { DeliveryApiService } from '../../services/delivery-api.service.js';
import { RiderTaskDetail, RiderTaskSummary } from '../../models/delivery.models.js';
import { Html5Qrcode } from 'html5-qrcode';

@Component({
  selector: 'app-rider',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  template: `
    <div class="delivery-theme min-h-[100dvh] bg-slate-900 text-slate-100 flex flex-col justify-between mobile-safe-bottom">
      <!-- Mobile Top Bar -->
      <header class="delivery-app-header bg-slate-800 border-b border-slate-700 px-3 sm:px-4 py-2.5 sm:py-3.5 sticky top-0 z-20 flex items-center justify-between gap-3">
        <div class="flex items-center gap-2 min-w-0">
          <span class="text-xl shrink-0">🛵</span>
          <div class="min-w-0">
            <h1 class="font-bold text-sm leading-tight text-white truncate">ระบบใบงานไรเดอร์ (ส่งด่วนมื้อเที่ยง)</h1>
            <p class="hidden sm:block text-[10px] text-slate-400">ร้านข้าวกล่องเดลิเวอรี ม.มหาสารคาม</p>
          </div>
        </div>
        <a routerLink="/" class="delivery-header-link min-h-10 px-2 inline-flex items-center text-xs text-orange-400 font-medium hover:underline shrink-0">
          <span class="hidden sm:inline">หน้าจัดงาน ↗</span><span class="sm:hidden">จัดงาน ↗</span>
        </a>
      </header>

      <!-- Main Container (Mobile Max Width) -->
      <main class="flex-1 max-w-md w-full mx-auto p-3 sm:p-4 space-y-4">
        <!-- Search / Task Number Input & QR Scanner Button -->
        <div class="bg-slate-800 p-3.5 rounded-2xl border border-slate-700 shadow-lg">
          <label class="block text-xs text-slate-400 font-medium mb-1.5">ค้นหาหรือสแกนรหัสใบงาน</label>
          <div class="grid grid-cols-[minmax(0,1fr)_auto] gap-2">
            <input 
              type="text" 
              [(ngModel)]="searchTaskNumber" 
              (keyup.enter)="loadTask(searchTaskNumber)"
              placeholder="เช่น TASK-20261008-01"
              class="min-w-0 min-h-11 bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-orange-500 uppercase font-mono"
            />
            <button 
              (click)="loadTask(searchTaskNumber)"
              class="min-h-11 px-3.5 py-2 bg-orange-500 hover:bg-orange-600 active:scale-95 text-white font-bold text-xs rounded-xl shadow transition whitespace-nowrap">
              ค้นหา
            </button>
            <button 
              (click)="openQrScanner()"
              class="col-span-2 min-h-11 px-3.5 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 active:scale-95 text-white font-bold text-xs rounded-xl shadow transition flex items-center justify-center gap-1.5 whitespace-nowrap">
              <span>📷</span> สแกน QR
            </button>
          </div>
        </div>

        <!-- Rider order management: reopen active jobs and review history -->
        <div class="bg-slate-800 rounded-2xl border border-slate-700 shadow-lg overflow-hidden">
          <button
            type="button"
            (click)="showMyTasks.set(!showMyTasks())"
            class="w-full min-h-11 p-3.5 flex items-center justify-between gap-3 text-left">
            <span class="min-w-0">
              <span class="text-sm font-bold text-white block">📦 งานของฉัน</span>
              <span class="text-[11px] text-slate-400">เปิดงานที่ค้างอยู่และดูประวัติการส่ง</span>
            </span>
            <span class="text-orange-400 text-xs">{{ showMyTasks() ? '▲ ปิด' : '▼ เปิด' }}</span>
          </button>

          @if (showMyTasks()) {
            <div class="border-t border-slate-700 p-3.5 space-y-3">
              <div class="grid grid-cols-[minmax(0,1fr)_auto] gap-2">
                <input
                  type="tel"
                  [(ngModel)]="riderLookupPhone"
                  (keyup.enter)="loadMyTasks()"
                  placeholder="เบอร์โทรที่ใช้รับงาน"
                  class="min-w-0 min-h-11 bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-orange-500"
                />
                <button
                  type="button"
                  (click)="loadMyTasks()"
                  [disabled]="tasksLoading()"
                  class="min-h-11 px-3 sm:px-4 py-2 bg-orange-500 text-white text-xs font-bold rounded-xl disabled:opacity-50 whitespace-nowrap">
                  {{ tasksLoading() ? 'กำลังโหลด' : 'ค้นหางาน' }}
                </button>
              </div>

              @if (riderProfileName()) {
                <div class="text-xs text-slate-300">ไรเดอร์: <strong class="text-white">{{ riderProfileName() }}</strong></div>
              }

              <div class="space-y-2 max-h-72 overflow-y-auto">
                @for (job of riderTasks(); track job.id) {
                  <button
                    type="button"
                    (click)="openTask(job.taskNumber)"
                    class="w-full bg-slate-900/70 border border-slate-700 rounded-xl p-3 text-left hover:border-orange-500 transition">
                    <div class="flex items-start justify-between gap-2">
                      <div>
                        <span class="font-mono text-xs font-bold text-white">{{ job.taskNumber }}</span>
                        <span class="text-[11px] text-slate-400 block mt-1">{{ job.totalBoxes }} กล่อง · {{ job.totalDistance }} กม. · {{ job.deliveryFee }} ฿</span>
                      </div>
                      <span class="text-[10px] font-bold px-2 py-1 rounded-full" [ngClass]="taskStatusClass(job.status)">
                        {{ taskStatusLabel(job.status) }}
                      </span>
                    </div>
                    <div class="mt-2 h-1.5 bg-slate-700 rounded-full overflow-hidden">
                      <div class="h-full bg-emerald-500" [style.width.%]="progressPercent(job.deliveredStops, job.totalStops)"></div>
                    </div>
                    <div class="flex justify-between mt-1 text-[10px] text-slate-400">
                      <span>ส่งแล้ว {{ job.deliveredStops }}/{{ job.totalStops }} จุด</span>
                      <span>{{ job.remainingStops > 0 ? 'เหลือ ' + job.remainingStops + ' จุด' : 'เสร็จครบแล้ว' }}</span>
                    </div>
                  </button>
                } @empty {
                  @if (hasLoadedMyTasks()) {
                    <div class="py-5 text-center text-xs text-slate-500">ไม่พบใบงานของเบอร์นี้</div>
                  }
                }
              </div>
            </div>
          }
        </div>

        @if (notice()) {
          <div class="rounded-xl border p-3 text-xs flex items-start justify-between gap-3"
               [ngClass]="notice()!.type === 'success' ? 'bg-emerald-950/50 border-emerald-700 text-emerald-200' : 'bg-red-950/50 border-red-700 text-red-200'">
            <span>{{ notice()!.message }}</span>
            <button type="button" (click)="notice.set(null)" class="font-bold opacity-70">✕</button>
          </div>
        }

        @if (task()) {
          <!-- Task Header Summary Card -->
          <div class="bg-gradient-to-br from-orange-600 to-amber-600 rounded-2xl p-4 sm:p-5 shadow-xl text-white">
            <div class="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-3 mb-2">
              <div>
                <span class="text-xs font-semibold px-2.5 py-0.5 bg-black/20 rounded-full">
                  {{ task()!.taskNumber }}
                </span>
                <h2 class="text-xl sm:text-2xl font-black mt-2">
                  หยิบรวม {{ task()!.totalBoxes }} กล่อง
                </h2>
              </div>
              <div class="text-left sm:text-right">
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

            @if (task()!.rider) {
              <div class="mt-3 pt-3 border-t border-white/20">
                <div class="flex justify-between text-[11px] mb-1.5">
                  <span>ความคืบหน้า {{ deliveredStops() }}/{{ task()!.stops.length }} จุด</span>
                  <span>เหลือ {{ remainingStops() }} จุด</span>
                </div>
                <div class="h-2 bg-black/20 rounded-full overflow-hidden">
                  <div class="h-full bg-emerald-300 transition-all" [style.width.%]="progressPercent(deliveredStops(), task()!.stops.length)"></div>
                </div>
              </div>
            }

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
              <div class="mt-3 pt-2 border-t border-white/20 text-xs text-amber-100 flex flex-wrap items-center justify-between gap-2">
                <span class="break-all">ไรเดอร์: {{ task()!.rider!.name }} ({{ task()!.rider!.phone }})</span>
                <span class="text-[10px] bg-black/20 px-2 py-0.5 rounded font-semibold text-emerald-300 shrink-0">✓ รับงานแล้ว</span>
              </div>
            }
          </div>

          <!-- Step-by-Step Delivery Stops Timeline: แสดงเฉพาะเมื่อคนขับลงชื่อแล้วเท่านั้น -->
          @if (task()!.rider) {
            <div class="space-y-3 animate-in fade-in duration-200">
              <div class="flex flex-wrap items-center justify-between gap-2 px-1">
                <h3 class="text-xs font-bold text-slate-400 uppercase tracking-wider">
                  ลำดับการจัดส่ง (เรียงตามเส้นทางที่สั้นที่สุด)
                </h3>
                <span class="text-[10px] text-emerald-400 font-semibold px-2 py-0.5 bg-emerald-950/60 border border-emerald-800/40 rounded-full">
                  {{ task()!.status === 'DELIVERED' ? 'ส่งครบแล้ว' : 'กำลังปฏิบัติงาน' }}
                </span>
              </div>

              @for (stop of task()!.stops; track stop.itemId) {
                <div 
                  class="rounded-2xl border p-3.5 sm:p-4 transition shadow-md"
                  [ngClass]="stop.deliveryStatus === 'DELIVERED' ? 'bg-slate-800/50 border-emerald-500/40 opacity-75' : 'bg-slate-800 border-slate-700'">
                  
                  <div class="flex flex-col sm:flex-row sm:items-start justify-between gap-2 mb-2">
                    <div class="flex items-center gap-2.5 min-w-0">
                      <span 
                        class="w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs shadow"
                        [ngClass]="stop.deliveryStatus === 'DELIVERED' ? 'bg-emerald-500 text-white' : 'bg-orange-500 text-white'">
                        {{ stop.deliveryStatus === 'DELIVERED' ? '✓' : stop.stopSequence }}
                      </span>
                      <div class="min-w-0">
                        <h4 class="font-bold text-sm text-white break-words">{{ stop.customerName }}</h4>
                        <span class="text-xs text-orange-400 font-semibold">{{ stop.boxAmount }} กล่อง</span>
                        @if (isNextPendingStop(stop.itemId)) {
                          <span class="ml-2 text-[10px] text-amber-300 font-bold">← จุดถัดไป</span>
                        }
                      </div>
                    </div>
                    
                    <span class="text-xs font-medium text-slate-400 sm:text-right">
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
                      class="min-h-11 py-2.5 px-2 sm:px-3 bg-slate-700 hover:bg-slate-600 active:scale-95 text-white font-medium text-xs rounded-xl flex items-center justify-center gap-1.5 transition">
                      <span>📞</span> โทรหาลูกค้า
                    </a>
                    <a 
                      [href]="stop.navigationUrl" 
                      target="_blank"
                      class="min-h-11 py-2.5 px-2 sm:px-3 bg-blue-600 hover:bg-blue-500 active:scale-95 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 transition">
                      <span>🗺️</span> นำทาง Maps
                    </a>
                  </div>

                  @if (stop.deliveryStatus !== 'DELIVERED') {
                    <button 
                      (click)="confirmDelivery(stop.itemId)"
                      [disabled]="!isNextPendingStop(stop.itemId) || updatingStopId() === stop.itemId"
                      class="w-full min-h-11 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 active:scale-95 text-white font-bold text-xs rounded-xl shadow-lg transition disabled:from-slate-700 disabled:to-slate-700 disabled:text-slate-400 disabled:shadow-none">
                      {{ updatingStopId() === stop.itemId ? 'กำลังบันทึก...' : isNextPendingStop(stop.itemId) ? '✓ ยืนยันส่งมอบจุดนี้สำเร็จ' : 'ส่งจุดก่อนหน้าให้เสร็จก่อน' }}
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
        <div class="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto" style="z-index: 99999;">
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
        <div class="fixed inset-0 bg-black/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-200 overflow-y-auto" style="z-index: 99999;">
          <div class="bg-slate-800 border border-slate-700 rounded-3xl p-4 sm:p-5 max-w-sm w-full max-h-[calc(100dvh-1.5rem)] overflow-y-auto shadow-2xl space-y-4">
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
  updatingStopId = signal<number | null>(null);

  // Rider order management state
  showMyTasks = signal<boolean>(false);
  tasksLoading = signal<boolean>(false);
  hasLoadedMyTasks = signal<boolean>(false);
  riderTasks = signal<RiderTaskSummary[]>([]);
  riderProfileName = signal<string>('');
  notice = signal<{ type: 'success' | 'error'; message: string } | null>(null);
  riderLookupPhone = '';

  // Scanner state
  showScannerModal = signal<boolean>(false);
  scannerError = signal<string | null>(null);
  private html5QrCode: Html5Qrcode | null = null;

  riderName = '';
  riderPhone = '';

  ngOnInit() {
    if (typeof window !== 'undefined') {
      this.riderLookupPhone = window.localStorage.getItem('riderPhone') ?? '';
      this.riderName = window.localStorage.getItem('riderName') ?? '';
    }
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
        if (data.rider && typeof window !== 'undefined') {
          this.riderLookupPhone = data.rider.phone;
          this.riderProfileName.set(data.rider.name);
          window.localStorage.setItem('riderPhone', data.rider.phone);
          window.localStorage.setItem('riderName', data.rider.name);
        }
        this.loading.set(false);
      },
      error: (err) => {
        this.notice.set({ type: 'error', message: err.error?.error || 'ไม่พบใบงานนี้' });
        this.loading.set(false);
      }
    });
  }

  loadMyTasks() {
    const phone = this.riderLookupPhone.trim();
    if (!phone) {
      this.notice.set({ type: 'error', message: 'กรุณากรอกเบอร์โทรที่ใช้รับงาน' });
      return;
    }

    this.tasksLoading.set(true);
    this.hasLoadedMyTasks.set(false);
    this.api.getRiderTasks(phone).subscribe({
      next: (response) => {
        this.riderTasks.set(response.tasks);
        this.riderProfileName.set(response.rider?.name ?? '');
        this.hasLoadedMyTasks.set(true);
        this.tasksLoading.set(false);
        if (response.rider && typeof window !== 'undefined') {
          window.localStorage.setItem('riderPhone', response.rider.phone);
          window.localStorage.setItem('riderName', response.rider.name);
        }
      },
      error: (err) => {
        this.tasksLoading.set(false);
        this.hasLoadedMyTasks.set(true);
        this.notice.set({ type: 'error', message: err.error?.error || 'โหลดรายการงานไม่สำเร็จ' });
      }
    });
  }

  openTask(taskNumber: string) {
    this.showMyTasks.set(false);
    this.searchTaskNumber = taskNumber;
    this.loadTask(taskNumber);
  }

  deliveredStops(): number {
    return this.task()?.stops.filter(stop => stop.deliveryStatus === 'DELIVERED').length ?? 0;
  }

  remainingStops(): number {
    return this.task()?.stops.filter(stop => stop.deliveryStatus !== 'DELIVERED').length ?? 0;
  }

  progressPercent(delivered: number, total: number): number {
    return total > 0 ? Math.round((delivered / total) * 100) : 0;
  }

  isNextPendingStop(itemId: number): boolean {
    return this.task()?.stops.find(stop => stop.deliveryStatus === 'PENDING')?.itemId === itemId;
  }

  taskStatusLabel(status: string): string {
    const labels: Record<string, string> = {
      CONFIRMED: 'รอรับงาน',
      IN_PROGRESS: 'กำลังส่ง',
      DELIVERED: 'ส่งครบแล้ว',
      CANCELLED: 'ยกเลิก'
    };
    return labels[status] ?? status;
  }

  taskStatusClass(status: string): string {
    const classes: Record<string, string> = {
      CONFIRMED: 'bg-blue-950 text-blue-300',
      IN_PROGRESS: 'bg-amber-950 text-amber-300',
      DELIVERED: 'bg-emerald-950 text-emerald-300',
      CANCELLED: 'bg-red-950 text-red-300'
    };
    return classes[status] ?? 'bg-slate-700 text-slate-300';
  }

  confirmDelivery(itemId: number) {
    const currentTask = this.task();
    if (!currentTask || !this.isNextPendingStop(itemId) || this.updatingStopId()) return;

    this.updatingStopId.set(itemId);
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
        this.updatingStopId.set(null);
        this.notice.set({ type: 'success', message: res.message });
        if (this.riderLookupPhone) this.loadMyTasks();
        if (res.isTaskCompleted) {
          this.notice.set({ type: 'success', message: '🎉 จัดส่งครบทุกจุดในใบงานนี้แล้ว' });
        }
      },
      error: (err) => {
        this.updatingStopId.set(null);
        this.notice.set({ type: 'error', message: err.error?.error || 'เกิดข้อผิดพลาดในการบันทึก' });
        this.loadTask(currentTask.taskNumber);
      }
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
        this.riderLookupPhone = this.riderPhone;
        if (typeof window !== 'undefined') {
          window.localStorage.setItem('riderPhone', this.riderPhone);
          window.localStorage.setItem('riderName', this.riderName);
        }
        this.showCheckinModal.set(false);
        this.notice.set({ type: 'success', message: 'รับใบงานเรียบร้อย เริ่มจัดส่งตามลำดับได้เลย' });
        this.loadMyTasks();
        this.loadTask(currentTask.taskNumber);
      },
      error: (err) => {
        const errorBody = err.error as { error?: string; code?: string; activeTaskNumber?: string };
        if (errorBody?.code === 'ACTIVE_TASK_EXISTS' && errorBody.activeTaskNumber) {
          this.showCheckinModal.set(false);
          this.riderLookupPhone = this.riderPhone;
          this.notice.set({
            type: 'error',
            message: `${errorBody.error} ระบบเปิดใบงานที่ค้างให้แล้ว`
          });
          if (typeof window !== 'undefined') {
            window.localStorage.setItem('riderPhone', this.riderPhone);
            window.localStorage.setItem('riderName', this.riderName);
          }
          this.loadMyTasks();
          this.openTask(errorBody.activeTaskNumber);
          return;
        }
        this.notice.set({ type: 'error', message: errorBody?.error || 'ไม่สามารถลงชื่อได้' });
      }
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
