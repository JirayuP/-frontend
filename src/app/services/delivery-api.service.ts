import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Order, OptimizationResult, ProposedTask, RiderTaskDetail } from '../models/delivery.models.js';

@Injectable({
  providedIn: 'root'
})
export class DeliveryApiService {
  private http = inject(HttpClient);
  private apiUrl = 'http://localhost:3000/api';

  // 1. Orders
  getOrders(): Observable<Order[]> {
    return this.http.get<Order[]>(`${this.apiUrl}/orders`);
  }

  getOrderById(id: number): Observable<Order> {
    return this.http.get<Order>(`${this.apiUrl}/orders/${id}`);
  }

  createOrder(data: { customerId: number; boxAmount: number }): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/orders`, data);
  }

  updateOrder(id: number, data: { boxAmount?: number; status?: string }): Observable<any> {
    return this.http.patch<any>(`${this.apiUrl}/orders/${id}`, data);
  }

  deleteOrder(id: number): Observable<any> {
    return this.http.delete<any>(`${this.apiUrl}/orders/${id}`);
  }

  getNearbyOrders(lat?: number, lng?: number, radius: number = 2): Observable<any> {
    let params = new HttpParams().set('radius', radius.toString());
    if (lat !== undefined && lng !== undefined) {
      params = params.set('lat', lat.toString()).set('lng', lng.toString());
    }
    return this.http.get<any>(`${this.apiUrl}/orders/nearby`, { params });
  }

  seedMockOrders(count?: number): Observable<any> {
    let params = new HttpParams();
    if (count !== undefined) {
      params = params.set('count', count.toString());
    }
    return this.http.post<any>(`${this.apiUrl}/orders/seed`, {}, { params });
  }

  clearOrders(): Observable<any> {
    return this.http.delete<any>(`${this.apiUrl}/orders`);
  }

  // 2. Customers
  getCustomers(search?: string): Observable<any> {
    let params = new HttpParams();
    if (search) {
      params = params.set('search', search);
    }
    return this.http.get<any>(`${this.apiUrl}/customers`, { params });
  }

  getCustomerById(id: number): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/customers/${id}`);
  }

  searchCustomers(name: string): Observable<any> {
    const params = new HttpParams().set('name', name);
    return this.http.get<any>(`${this.apiUrl}/customers/search`, { params });
  }

  getNearbyCustomers(lat?: number, lng?: number, radius: number = 1): Observable<any> {
    let params = new HttpParams().set('radius', radius.toString());
    if (lat !== undefined && lng !== undefined) {
      params = params.set('lat', lat.toString()).set('lng', lng.toString());
    }
    return this.http.get<any>(`${this.apiUrl}/customers/nearby`, { params });
  }

  createCustomer(customer: any): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/customers`, customer);
  }

  updateCustomer(id: number, customer: any): Observable<any> {
    return this.http.patch<any>(`${this.apiUrl}/customers/${id}`, customer);
  }

  deleteCustomer(id: number): Observable<any> {
    return this.http.delete<any>(`${this.apiUrl}/customers/${id}`);
  }

  // 2. Optimization
  optimizeRoutes(): Observable<OptimizationResult> {
    return this.http.post<OptimizationResult>(`${this.apiUrl}/routes/optimize`, {});
  }

  confirmTasks(tasks: ProposedTask[]): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/routes/confirm`, { tasks });
  }

  // 3. Rider & Tasks
  getTasks(): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/tasks`);
  }

  getTaskByNumber(taskNumber: string): Observable<RiderTaskDetail> {
    return this.http.get<RiderTaskDetail>(`${this.apiUrl}/tasks/${taskNumber}`);
  }

  getTaskQr(taskNumber: string): Observable<{ taskNumber: string; qrDataUrl: string }> {
    return this.http.get<{ taskNumber: string; qrDataUrl: string }>(`${this.apiUrl}/tasks/${taskNumber}/qr`);
  }

  completeStop(taskNumber: string, itemId: number): Observable<any> {
    return this.http.patch<any>(`${this.apiUrl}/tasks/${taskNumber}/stops/${itemId}/complete`, {});
  }

  riderCheckIn(taskNumber: string, riderData: { riderName: string; riderPhone: string; vehiclePlate?: string }): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/tasks/${taskNumber}/checkin`, riderData);
  }
}
