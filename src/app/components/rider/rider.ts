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
  templateUrl: './rider.html'
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
