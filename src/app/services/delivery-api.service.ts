import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import {
  ConfirmTasksResponse,
  CompleteStopResponse,
  Customer,
  CustomerListResponse,
  CustomerMutationResponse,
  Order,
  OrderMutationResponse,
  OptimizationResult,
  ProposedTask,
  RiderTaskDetail,
  RiderTasksResponse,
  RouteStrategy
} from '../models/delivery.models.js';

@Injectable({
  providedIn: 'root'
})
export class DeliveryApiService {
  private http = inject(HttpClient);

  // สลับ URL อัตโนมัติ: เชื่อมต่อ Localhost (พอร์ต 3000) เมื่อรันบนเครื่อง และใช้ Railway เมื่อ Deploy บน Cloud
  private apiUrl =
    typeof window !== 'undefined' &&
    (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
      ? 'http://localhost:3000/api'
      : 'https://adventurous-caring-production-d78e.up.railway.app/api';

  // 1. Orders
  // ดึงรายการออเดอร์ทั้งหมด
  getOrders(): Observable<Order[]> {
    return this.http.get<Order[]>(`${this.apiUrl}/orders`);
  }

  // ดึงรายละเอียดออเดอร์ตามรหัส
  getOrderById(id: number): Observable<Order> {
    return this.http.get<Order>(`${this.apiUrl}/orders/${id}`);
  }

  // สร้างออเดอร์ใหม่
  createOrder(data: { customerId: number; boxAmount: number }): Observable<OrderMutationResponse> {
    return this.http.post<OrderMutationResponse>(`${this.apiUrl}/orders`, data);
  }

  // แก้ไขจำนวนกล่องหรือสถานะของออเดอร์
  updateOrder(id: number, data: { boxAmount?: number; status?: string }): Observable<OrderMutationResponse> {
    return this.http.patch<OrderMutationResponse>(`${this.apiUrl}/orders/${id}`, data);
  }

  // ลบออเดอร์ตามรหัส
  deleteOrder(id: number): Observable<any> {
    return this.http.delete<any>(`${this.apiUrl}/orders/${id}`);
  }

  // ค้นหาออเดอร์ที่อยู่ใกล้พิกัดที่กำหนด
  getNearbyOrders(lat?: number, lng?: number, radius: number = 2): Observable<any> {
    let params = new HttpParams().set('radius', radius.toString());
    if (lat !== undefined && lng !== undefined) {
      params = params.set('lat', lat.toString()).set('lng', lng.toString());
    }
    return this.http.get<any>(`${this.apiUrl}/orders/nearby`, { params });
  }

  // สร้างออเดอร์จำลองสำหรับทดสอบระบบ
  seedMockOrders(count?: number): Observable<any> {
    let params = new HttpParams();
    if (count !== undefined) {
      params = params.set('count', count.toString());
    }
    return this.http.post<any>(`${this.apiUrl}/orders/seed`, {}, { params });
  }

  // ลบออเดอร์ทั้งหมด
  clearOrders(): Observable<any> {
    return this.http.delete<any>(`${this.apiUrl}/orders`);
  }

  // 2. Customers
  // ดึงรายชื่อลูกค้าและกรองด้วยคำค้นถ้ามี
  getCustomers(search?: string): Observable<CustomerListResponse> {
    let params = new HttpParams();
    if (search) {
      params = params.set('search', search);
    }
    return this.http.get<CustomerListResponse>(`${this.apiUrl}/customers`, { params });
  }

  // ดึงรายละเอียดลูกค้าตามรหัส
  getCustomerById(id: number): Observable<Customer> {
    return this.http.get<Customer>(`${this.apiUrl}/customers/${id}`);
  }

  // ค้นหาลูกค้าด้วยชื่อ
  searchCustomers(name: string): Observable<any> {
    const params = new HttpParams().set('name', name);
    return this.http.get<any>(`${this.apiUrl}/customers/search`, { params });
  }

  // ค้นหาลูกค้าที่อยู่ใกล้พิกัดที่กำหนด
  getNearbyCustomers(lat?: number, lng?: number, radius: number = 1): Observable<any> {
    let params = new HttpParams().set('radius', radius.toString());
    if (lat !== undefined && lng !== undefined) {
      params = params.set('lat', lat.toString()).set('lng', lng.toString());
    }
    return this.http.get<any>(`${this.apiUrl}/customers/nearby`, { params });
  }

  // สร้างข้อมูลลูกค้าใหม่
  createCustomer(customer: Omit<Customer, 'id' | '_count' | 'orders'>): Observable<CustomerMutationResponse> {
    return this.http.post<CustomerMutationResponse>(`${this.apiUrl}/customers`, customer);
  }

  // แก้ไขข้อมูลลูกค้าตามรหัส
  updateCustomer(id: number, customer: Partial<Omit<Customer, 'id' | '_count' | 'orders'>>): Observable<CustomerMutationResponse> {
    return this.http.patch<CustomerMutationResponse>(`${this.apiUrl}/customers/${id}`, customer);
  }

  // ลบลูกค้าตามรหัส
  deleteCustomer(id: number): Observable<any> {
    return this.http.delete<any>(`${this.apiUrl}/customers/${id}`);
  }

  // 3. Optimization
  // ส่งคำขอให้ Backend คำนวณแผนเส้นทาง
  optimizeRoutes(): Observable<OptimizationResult> {
    return this.http.post<OptimizationResult>(`${this.apiUrl}/routes/optimize`, {});
  }

  // ดึงแผนเส้นทางของวันนี้
  getTodayRoutes(): Observable<OptimizationResult> {
    return this.http.get<OptimizationResult>(`${this.apiUrl}/routes/today`);
  }
  // ยืนยันแผนและบันทึกเป็นใบงาน
  confirmTasks(tasks: ProposedTask[], strategy: RouteStrategy): Observable<ConfirmTasksResponse> {
    return this.http.post<ConfirmTasksResponse>(`${this.apiUrl}/routes/confirm`, { tasks, strategy });
  }

  // 4. Rider & Tasks
  // ดึงรายการใบงานทั้งหมด
  getTasks(): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/tasks`);
  }

  // ดึงรายละเอียดใบงานตามหมายเลขงาน
  getTaskByNumber(taskNumber: string): Observable<RiderTaskDetail> {
    return this.http.get<RiderTaskDetail>(`${this.apiUrl}/tasks/${taskNumber}`);
  }

  // ดึงใบงานของไรเดอร์ตามเบอร์โทรศัพท์
  getRiderTasks(phone: string): Observable<RiderTasksResponse> {
    return this.http.get<RiderTasksResponse>(
      `${this.apiUrl}/tasks/rider/${encodeURIComponent(phone)}`
    );
  }

  // ดึง QR Code ของใบงาน
  getTaskQr(taskNumber: string): Observable<{ taskNumber: string; qrDataUrl: string }> {
    return this.http.get<{ taskNumber: string; qrDataUrl: string }>(`${this.apiUrl}/tasks/${taskNumber}/qr`);
  }

  // บันทึกว่าจุดส่งสินค้านี้เสร็จสิ้นแล้ว
  completeStop(taskNumber: string, itemId: number): Observable<CompleteStopResponse> {
    return this.http.patch<CompleteStopResponse>(`${this.apiUrl}/tasks/${taskNumber}/stops/${itemId}/complete`, {});
  }
  // บันทึกข้อมูลเมื่อไรเดอร์รับงาน
  riderCheckIn(taskNumber: string, riderData: { riderName: string; riderPhone: string; vehiclePlate?: string }): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/tasks/${taskNumber}/checkin`, riderData);
  }
}
