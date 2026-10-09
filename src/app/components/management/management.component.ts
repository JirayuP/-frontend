import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import * as L from 'leaflet';
import { Customer, Order } from '../../models/delivery.models.js';
import { DeliveryApiService } from '../../services/delivery-api.service.js';

interface CustomerForm {
  name: string;
  phone: string;
  addressDetail: string;
  latitude: number;
  longitude: number;
}

@Component({
  selector: 'app-management',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="min-h-screen bg-slate-50 text-slate-800 pb-12">
      <header class="bg-gradient-to-r from-slate-800 to-slate-700 text-white shadow-lg">
        <div class="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div>
            <h1 class="font-bold">จัดการลูกค้าและออเดอร์</h1>
            <p class="text-xs text-slate-300">รับเฉพาะที่อยู่ในรัศมี 3 กม. จากร้าน</p>
          </div>
          <a href="/" class="px-3 py-2 text-xs font-semibold bg-white/15 rounded-lg hover:bg-white/25">← กลับหน้าจัดเส้นทาง</a>
        </div>
      </header>

      <main class="max-w-7xl mx-auto px-4 mt-6 space-y-6">
        @if (message()) {
          <div class="p-3 rounded-lg text-sm" [ngClass]="hasError() ? 'bg-red-50 text-red-700 border border-red-200' : 'bg-emerald-50 text-emerald-700 border border-emerald-200'">
            {{ message() }}
          </div>
        }

        <section class="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <form (ngSubmit)="saveCustomer()" class="bg-white border border-slate-200 rounded-xl shadow-sm p-5 space-y-3">
            <div class="flex items-center justify-between">
              <h2 class="font-bold">{{ editingCustomerId() ? 'แก้ไขลูกค้า' : 'เพิ่มลูกค้า' }}</h2>
              @if (editingCustomerId()) {
                <button type="button" (click)="resetCustomerForm()" class="text-xs text-slate-500 hover:text-slate-800">ยกเลิกแก้ไข</button>
              }
            </div>
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label class="text-xs text-slate-600">ชื่อ-นามสกุล
                <input [(ngModel)]="customerForm.name" name="name" required class="mt-1 w-full border rounded-lg px-3 py-2 text-sm" />
              </label>
              <label class="text-xs text-slate-600">เบอร์โทร
                <input [(ngModel)]="customerForm.phone" name="phone" required class="mt-1 w-full border rounded-lg px-3 py-2 text-sm" />
              </label>
            </div>
            <label class="text-xs text-slate-600 block">รายละเอียดที่อยู่
              <textarea [(ngModel)]="customerForm.addressDetail" name="addressDetail" required rows="2" class="mt-1 w-full border rounded-lg px-3 py-2 text-sm"></textarea>
            </label>
            <div class="grid grid-cols-2 gap-3">
              <label class="text-xs text-slate-600">Latitude
                <input [(ngModel)]="customerForm.latitude" name="latitude" required type="number" step="any" class="mt-1 w-full border rounded-lg px-3 py-2 text-sm" />
              </label>
              <label class="text-xs text-slate-600">Longitude
                <input [(ngModel)]="customerForm.longitude" name="longitude" required type="number" step="any" class="mt-1 w-full border rounded-lg px-3 py-2 text-sm" />
              </label>
            </div>
            <p class="text-xs text-slate-400">คลิกแผนที่เพื่อเลือกพิกัด โดยวงกลมสีส้มคือขอบเขตให้บริการ 3 กม.</p>
            <button [disabled]="loading()" class="w-full py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg text-sm font-bold disabled:opacity-50">
              {{ editingCustomerId() ? 'บันทึกการแก้ไข' : 'เพิ่มลูกค้า' }}
            </button>
          </form>

          <div class="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
            <div class="px-4 py-3 border-b text-sm font-bold">เลือกตำแหน่งลูกค้า</div>
            <div id="customer-map" class="h-[360px]"></div>
          </div>
        </section>

        <section class="bg-white border border-slate-200 rounded-xl shadow-sm p-5">
          <div class="flex flex-wrap items-end justify-between gap-4 mb-4">
            <div>
              <h2 class="font-bold">รายชื่อลูกค้า ({{ customers().length }})</h2>
              <p class="text-xs text-slate-500">แก้ไขข้อมูลหรือเลือกลูกค้าเพื่อสร้างออเดอร์</p>
            </div>
            <form (ngSubmit)="createOrder()" class="flex flex-wrap items-end gap-2">
              <label class="text-xs text-slate-600">ลูกค้า
                <select [(ngModel)]="newOrderCustomerId" name="customerId" required class="mt-1 block border rounded-lg px-3 py-2 text-sm min-w-48">
                  <option [ngValue]="0" disabled>เลือกลูกค้า</option>
                  @for (customer of customers(); track customer.id) {
                    <option [ngValue]="customer.id">{{ customer.name }}</option>
                  }
                </select>
              </label>
              <label class="text-xs text-slate-600">จำนวนกล่อง
                <select [(ngModel)]="newOrderBoxes" name="boxes" class="mt-1 block border rounded-lg px-3 py-2 text-sm">
                  <option [ngValue]="1">1</option><option [ngValue]="2">2</option><option [ngValue]="3">3</option>
                </select>
              </label>
              <button [disabled]="loading() || !newOrderCustomerId" class="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-bold disabled:opacity-50">สร้างออเดอร์</button>
            </form>
          </div>
          <div class="overflow-x-auto">
            <table class="w-full text-sm">
              <thead class="text-xs text-slate-500 border-b"><tr><th class="text-left py-2">ลูกค้า</th><th class="text-left">ติดต่อ/ที่อยู่</th><th>ออเดอร์</th><th class="text-right">จัดการ</th></tr></thead>
              <tbody>
                @for (customer of customers(); track customer.id) {
                  <tr class="border-b border-slate-100">
                    <td class="py-3 font-semibold">{{ customer.name }}</td>
                    <td class="py-3"><span class="block">{{ customer.phone }}</span><span class="text-xs text-slate-400">{{ customer.addressDetail }}</span></td>
                    <td class="py-3 text-center">{{ customer._count?.orders ?? 0 }}</td>
                    <td class="py-3 text-right whitespace-nowrap">
                      <button (click)="editCustomer(customer)" class="text-blue-600 hover:bg-blue-50 px-2 py-1 rounded">แก้ไข</button>
                      <button (click)="deleteCustomer(customer)" class="text-red-600 hover:bg-red-50 px-2 py-1 rounded">ลบ</button>
                    </td>
                  </tr>
                } @empty {
                  <tr><td colspan="4" class="text-center text-slate-400 py-8">ยังไม่มีข้อมูลลูกค้า</td></tr>
                }
              </tbody>
            </table>
          </div>
        </section>

        <section class="bg-white border border-slate-200 rounded-xl shadow-sm p-5">
          <h2 class="font-bold mb-4">ออเดอร์ทั้งหมด ({{ orders().length }})</h2>
          <div class="overflow-x-auto">
            <table class="w-full text-sm">
              <thead class="text-xs text-slate-500 border-b"><tr><th class="text-left py-2">#</th><th class="text-left">ลูกค้า</th><th>จำนวน</th><th>ยอด</th><th>สถานะ</th><th class="text-right">จัดการ</th></tr></thead>
              <tbody>
                @for (order of orders(); track order.id) {
                  <tr class="border-b border-slate-100">
                    <td class="py-3">{{ order.id }}</td><td>{{ order.customer.name }}</td>
                    <td class="text-center">
                      @if (order.status === 'PENDING') {
                        <select [ngModel]="order.boxAmount" (ngModelChange)="updateOrderBoxes(order, $event)" [ngModelOptions]="{standalone: true}" class="border rounded px-2 py-1">
                          <option [ngValue]="1">1</option><option [ngValue]="2">2</option><option [ngValue]="3">3</option>
                        </select>
                      } @else { {{ order.boxAmount }} }
                    </td>
                    <td class="text-center">{{ order.totalPrice }} ฿</td>
                    <td class="text-center"><span class="text-xs px-2 py-1 rounded-full bg-slate-100">{{ order.status }}</span></td>
                    <td class="text-right">
                      <button (click)="deleteOrder(order)" [disabled]="order.status !== 'PENDING'" class="text-red-600 hover:bg-red-50 px-2 py-1 rounded disabled:text-slate-300">ลบ</button>
                    </td>
                  </tr>
                } @empty {
                  <tr><td colspan="6" class="text-center text-slate-400 py-8">ยังไม่มีออเดอร์</td></tr>
                }
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </div>
  `
})
export class ManagementComponent implements OnInit, OnDestroy {
  private readonly api = inject(DeliveryApiService);
  private readonly hub = L.latLng(16.246825, 103.252072);
  private map: L.Map | null = null;
  private markers = L.layerGroup();
  private selectedMarker: L.Marker | null = null;

  customers = signal<Customer[]>([]);
  orders = signal<Order[]>([]);
  loading = signal(false);
  message = signal<string | null>(null);
  hasError = signal(false);
  editingCustomerId = signal<number | null>(null);

  customerForm: CustomerForm = this.emptyCustomerForm();
  newOrderCustomerId = 0;
  newOrderBoxes = 1;

  ngOnInit(): void {
    this.loadAll();
    setTimeout(() => this.initMap());
  }

  ngOnDestroy(): void {
    this.map?.remove();
  }

  loadAll(): void {
    this.loading.set(true);
    this.api.getCustomers().subscribe({
      next: ({ customers }) => {
        this.customers.set(customers);
        this.renderCustomerMarkers();
        this.api.getOrders().subscribe({
          next: (orders) => { this.orders.set(orders); this.loading.set(false); },
          error: (error) => this.fail(error)
        });
      },
      error: (error) => this.fail(error)
    });
  }

  saveCustomer(): void {
    const payload = { ...this.customerForm };
    const request = this.editingCustomerId()
      ? this.api.updateCustomer(this.editingCustomerId()!, payload)
      : this.api.createCustomer(payload);
    this.loading.set(true);
    request.subscribe({
      next: (response) => {
        this.succeed(response.message);
        this.resetCustomerForm();
        this.loadAll();
      },
      error: (error) => this.fail(error)
    });
  }

  editCustomer(customer: Customer): void {
    this.editingCustomerId.set(customer.id);
    this.customerForm = {
      name: customer.name,
      phone: customer.phone,
      addressDetail: customer.addressDetail,
      latitude: customer.latitude,
      longitude: customer.longitude
    };
    this.showSelectedLocation(customer.latitude, customer.longitude);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  resetCustomerForm(): void {
    this.editingCustomerId.set(null);
    this.customerForm = this.emptyCustomerForm();
    this.showSelectedLocation(this.customerForm.latitude, this.customerForm.longitude);
  }

  deleteCustomer(customer: Customer): void {
    if (!confirm(`ลบลูกค้า ${customer.name} หรือไม่?`)) return;
    this.loading.set(true);
    this.api.deleteCustomer(customer.id).subscribe({
      next: () => { this.succeed('ลบลูกค้าแล้ว'); this.loadAll(); },
      error: (error) => this.fail(error)
    });
  }

  createOrder(): void {
    if (!this.newOrderCustomerId) return;
    this.loading.set(true);
    this.api.createOrder({ customerId: this.newOrderCustomerId, boxAmount: this.newOrderBoxes }).subscribe({
      next: (response) => { this.succeed(response.message); this.loadAll(); },
      error: (error) => this.fail(error)
    });
  }

  updateOrderBoxes(order: Order, boxAmount: number): void {
    this.loading.set(true);
    this.api.updateOrder(order.id, { boxAmount }).subscribe({
      next: (response) => { this.succeed(response.message); this.loadAll(); },
      error: (error) => this.fail(error)
    });
  }

  deleteOrder(order: Order): void {
    if (order.status !== 'PENDING' || !confirm(`ลบออเดอร์ #${order.id} หรือไม่?`)) return;
    this.loading.set(true);
    this.api.deleteOrder(order.id).subscribe({
      next: () => { this.succeed('ลบออเดอร์แล้ว'); this.loadAll(); },
      error: (error) => this.fail(error)
    });
  }

  private initMap(): void {
    this.map = L.map('customer-map').setView(this.hub, 14);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors'
    }).addTo(this.map);
    L.circle(this.hub, { radius: 3000, color: '#f97316', fillOpacity: 0.05 }).addTo(this.map);
    L.marker(this.hub).bindPopup('จุดเริ่มต้น / ร้าน').addTo(this.map);
    this.markers.addTo(this.map);
    this.map.on('click', (event: L.LeafletMouseEvent) => {
      this.customerForm.latitude = Number(event.latlng.lat.toFixed(6));
      this.customerForm.longitude = Number(event.latlng.lng.toFixed(6));
      this.showSelectedLocation(event.latlng.lat, event.latlng.lng);
    });
    this.renderCustomerMarkers();
  }

  private renderCustomerMarkers(): void {
    if (!this.map) return;
    this.markers.clearLayers();
    for (const customer of this.customers()) {
      L.circleMarker([customer.latitude, customer.longitude], {
        radius: 6,
        color: '#2563eb',
        fillOpacity: 0.8
      }).bindPopup(`<b>${this.escapeHtml(customer.name)}</b><br>${this.escapeHtml(customer.addressDetail)}`).addTo(this.markers);
    }
  }

  private showSelectedLocation(latitude: number, longitude: number): void {
    if (!this.map) return;
    this.selectedMarker?.remove();
    this.selectedMarker = L.marker([latitude, longitude]).addTo(this.map).bindPopup('พิกัดที่เลือก').openPopup();
    this.map.panTo([latitude, longitude]);
  }

  private emptyCustomerForm(): CustomerForm {
    return { name: '', phone: '', addressDetail: '', latitude: 16.246825, longitude: 103.252072 };
  }

  private succeed(message: string): void {
    this.message.set(message);
    this.hasError.set(false);
    this.loading.set(false);
  }

  private fail(error: unknown): void {
    const message = error instanceof HttpErrorResponse
      ? String(error.error?.error ?? error.message)
      : error instanceof Error ? error.message : 'เกิดข้อผิดพลาด';
    this.message.set(message);
    this.hasError.set(true);
    this.loading.set(false);
  }

  private escapeHtml(value: string): string {
    return value.replace(/[&<>'"]/g, (character) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
    })[character] ?? character);
  }
}
