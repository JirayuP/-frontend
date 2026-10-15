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
  templateUrl: './management.html'
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
