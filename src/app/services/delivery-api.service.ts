import { Injectable } from '@angular/core';
import { Observable, of, throwError } from 'rxjs';
import {
  ConfirmTasksResponse, CompleteStopResponse, Customer, CustomerListResponse,
  CustomerMutationResponse, Order, OrderMutationResponse, OptimizationAlternative,
  OptimizationResult, OptimizationSummary, OptimizedStop, ProposedTask,
  RiderTaskDetail, RiderTasksResponse, RouteStrategy
} from '../models/delivery.models.js';

const HUB = { name: 'Demo Hub', latitude: 16.246825, longitude: 103.252072, radiusKm: 3 };
const ROUTE_COLORS = ['#f97316', '#2563eb', '#16a34a', '#9333ea', '#e11d48'];
const BOX_PRICE = 60;
const RIDER_RATE_PER_KM = 10;

/** Frontend-only demo store. State is held in memory; no HTTP or backend is used. */
@Injectable({ providedIn: 'root' })
export class DeliveryApiService {
  private customers: Customer[] = [
    { id: 1, name: 'สมชาย ใจดี', phone: '0812345678', addressDetail: 'มหาวิทยาลัยมหาสารคาม', latitude: 16.2452, longitude: 103.2501 },
    { id: 2, name: 'สุดา รักเรียน', phone: '0823456789', addressDetail: 'ตลาดท่าขอนยาง', latitude: 16.2429, longitude: 103.2538 },
    { id: 3, name: 'วิชัย แสนสุข', phone: '0834567890', addressDetail: 'หอพักใกล้คณะวิทยาศาสตร์', latitude: 16.2491, longitude: 103.2553 },
    { id: 4, name: 'มาลี ตั้งใจ', phone: '0845678901', addressDetail: 'ถนนนครสวรรค์ ตำบลตลาด', latitude: 16.2385, longitude: 103.2477 },
    { id: 5, name: 'ธนา พูนทรัพย์', phone: '0856789012', addressDetail: 'หอพักโซนท่าขอนยาง', latitude: 16.2513, longitude: 103.2456 }
  ];
  private orders: Order[] = [];
  private tasks: ProposedTask[] = [];
  private optimization: OptimizationResult | null = null;
  private nextCustomerId = 6;
  private nextOrderId = 1;

  getOrders(): Observable<Order[]> { return of(this.orders.map(order => this.withCustomer(order))); }
  getOrderById(id: number): Observable<Order> {
    const order = this.orders.find(item => item.id === id);
    return order ? of(this.withCustomer(order)) : this.fail(`ไม่พบออเดอร์ #${id}`);
  }
  createOrder(data: { customerId: number; boxAmount: number }): Observable<OrderMutationResponse> {
    const customer = this.customers.find(item => item.id === data.customerId);
    if (!customer) return this.fail('ไม่พบข้อมูลลูกค้า');
    if (!Number.isFinite(data.boxAmount) || data.boxAmount < 1) return this.fail('จำนวนกล่องไม่ถูกต้อง');
    const order: Order = {
      id: this.nextOrderId++, customerId: customer.id, boxAmount: data.boxAmount,
      totalPrice: data.boxAmount * BOX_PRICE, status: 'PENDING', createdAt: new Date().toISOString(), customer: { ...customer }
    };
    this.orders.push(order);
    return of({ message: 'เพิ่มออเดอร์แล้ว (ข้อมูลตัวอย่าง)', order: this.withCustomer(order) });
  }
  updateOrder(id: number, data: { boxAmount?: number; status?: string }): Observable<OrderMutationResponse> {
    const order = this.orders.find(item => item.id === id);
    if (!order) return this.fail(`ไม่พบออเดอร์ #${id}`);
    if (data.boxAmount !== undefined) {
      if (!Number.isFinite(data.boxAmount) || data.boxAmount < 1) return this.fail('จำนวนกล่องไม่ถูกต้อง');
      order.boxAmount = data.boxAmount;
      order.totalPrice = data.boxAmount * BOX_PRICE;
    }
    if (data.status && ['PENDING', 'ASSIGNED', 'DELIVERED', 'CANCELLED'].includes(data.status)) order.status = data.status as Order['status'];
    return of({ message: 'บันทึกออเดอร์แล้ว (ข้อมูลตัวอย่าง)', order: this.withCustomer(order) });
  }
  deleteOrder(id: number): Observable<{ message: string }> {
    const index = this.orders.findIndex(item => item.id === id);
    if (index < 0) return this.fail(`ไม่พบออเดอร์ #${id}`);
    this.orders.splice(index, 1);
    return of({ message: 'ลบออเดอร์แล้ว (ข้อมูลตัวอย่าง)' });
  }
  getNearbyOrders(lat?: number, lng?: number, radius = 2): Observable<Order[]> {
    return of(this.orders.filter(order => lat === undefined || lng === undefined || this.distanceKm(lat, lng, order.customer.latitude, order.customer.longitude) <= radius).map(order => this.withCustomer(order)));
  }
  seedMockOrders(count = 22): Observable<{ message: string; count: number }> {
    this.clearDemoOrders();
    const quantity = Math.max(0, Math.floor(count));
    for (let index = 0; index < quantity; index++) {
      const customer = this.customers[index % this.customers.length];
      const spread = Math.floor(index / this.customers.length);
      const latitude = customer.latitude + (spread ? (spread % 2 ? 1 : -1) * 0.0008 * spread : 0);
      const longitude = customer.longitude + (spread ? (spread % 3 - 1) * 0.0009 * spread : 0);
      const order: Order = {
        id: this.nextOrderId++, customerId: customer.id, boxAmount: index % 4 + 1,
        totalPrice: (index % 4 + 1) * BOX_PRICE, status: 'PENDING', createdAt: new Date().toISOString(),
        customer: { ...customer, latitude, longitude }
      };
      this.orders.push(order);
    }
    return of({ message: 'สร้างออเดอร์ตัวอย่างแล้ว', count: quantity });
  }
  clearOrders(): Observable<{ message: string }> { this.clearDemoOrders(); return of({ message: 'ล้างออเดอร์ตัวอย่างแล้ว' }); }

  getCustomers(search?: string): Observable<CustomerListResponse> {
    const term = search?.trim().toLocaleLowerCase();
    const customers = this.customers.filter(customer => !term || `${customer.name} ${customer.phone} ${customer.addressDetail}`.toLocaleLowerCase().includes(term)).map(customer => this.withOrderCount(customer));
    return of({ count: customers.length, customers });
  }
  getCustomerById(id: number): Observable<Customer> {
    const customer = this.customers.find(item => item.id === id);
    return customer ? of(this.withOrderCount(customer)) : this.fail(`ไม่พบลูกค้า #${id}`);
  }
  searchCustomers(name: string): Observable<Customer[]> {
    const term = name.trim().toLocaleLowerCase();
    return of(this.customers.filter(customer => customer.name.toLocaleLowerCase().includes(term)).map(customer => this.withOrderCount(customer)));
  }
  getNearbyCustomers(lat?: number, lng?: number, radius = 1): Observable<Customer[]> {
    return of(this.customers.filter(customer => lat === undefined || lng === undefined || this.distanceKm(lat, lng, customer.latitude, customer.longitude) <= radius).map(customer => this.withOrderCount(customer)));
  }
  createCustomer(data: Omit<Customer, 'id' | '_count' | 'orders'>): Observable<CustomerMutationResponse> {
    if (!data.name.trim() || !data.phone.trim()) return this.fail('กรุณากรอกชื่อลูกค้าและเบอร์โทร');
    const customer: Customer = { ...data, id: this.nextCustomerId++ };
    this.customers.push(customer);
    return of({ message: 'เพิ่มลูกค้าแล้ว (ข้อมูลตัวอย่าง)', customer: this.withOrderCount(customer) });
  }
  updateCustomer(id: number, data: Partial<Omit<Customer, 'id' | '_count' | 'orders'>>): Observable<CustomerMutationResponse> {
    const customer = this.customers.find(item => item.id === id);
    if (!customer) return this.fail(`ไม่พบลูกค้า #${id}`);
    Object.assign(customer, data);
    for (const order of this.orders) if (order.customerId === id) order.customer = { ...customer };
    return of({ message: 'บันทึกข้อมูลลูกค้าแล้ว (ข้อมูลตัวอย่าง)', customer: this.withOrderCount(customer) });
  }
  deleteCustomer(id: number): Observable<{ message: string }> {
    if (this.orders.some(order => order.customerId === id)) return this.fail('ลบไม่ได้: ลูกค้ามีออเดอร์อยู่');
    const index = this.customers.findIndex(item => item.id === id);
    if (index < 0) return this.fail(`ไม่พบลูกค้า #${id}`);
    this.customers.splice(index, 1);
    return of({ message: 'ลบลูกค้าแล้ว (ข้อมูลตัวอย่าง)' });
  }

  optimizeRoutes(): Observable<OptimizationResult> {
    const pending = this.orders.filter(order => order.status === 'PENDING');
    const alternatives = [
      this.makeAlternative('LOWEST_COST', pending, 8),
      this.makeAlternative('FASTEST', pending, 4),
      this.makeAlternative('FEWEST_RIDERS', pending, 12)
    ];
    this.optimization = this.resultFromAlternative(alternatives[0], alternatives);
    return of(this.clone(this.optimization));
  }
  getTodayRoutes(): Observable<OptimizationResult> { return of(this.optimization ? this.clone(this.optimization) : this.emptyResult()); }
  confirmTasks(tasks: ProposedTask[], strategy: RouteStrategy): Observable<ConfirmTasksResponse> {
    const confirmed = tasks.map(task => ({ ...this.clone(task), status: 'CONFIRMED' as const, rider: null }));
    for (const task of confirmed) for (const stop of task.stops) {
      const order = this.orders.find(item => item.id === stop.orderId);
      if (order) { order.status = 'ASSIGNED'; order.taskItem = { task: { taskNumber: task.taskNumber, routeColor: task.routeColor } }; }
    }
    this.tasks = confirmed;
    const alternatives = this.optimization?.alternatives ?? [];
    const chosen = alternatives.find(item => item.strategy === strategy) ?? this.makeAlternative(strategy, [], 8);
    this.optimization = this.resultFromAlternative({ ...chosen, tasks: confirmed }, alternatives);
    return of({ message: 'ปล่อยงานตัวอย่างให้ไรเดอร์แล้ว', result: this.clone(this.optimization) });
  }

  getTasks(): Observable<RiderTaskDetail[]> { return of(this.tasks.map((task, index) => this.taskDetail(task, index))); }
  getTaskByNumber(taskNumber: string): Observable<RiderTaskDetail> {
    const index = this.tasks.findIndex(task => task.taskNumber.toUpperCase() === taskNumber.toUpperCase());
    return index >= 0 ? of(this.taskDetail(this.tasks[index], index)) : this.fail('ไม่พบใบงานนี้ ลองสร้างออเดอร์ตัวอย่างและจัดเส้นทางก่อน');
  }
  getRiderTasks(phone: string): Observable<RiderTasksResponse> {
    const normalizedPhone = phone.replace(/\D/g, '');
    const matching = this.tasks.map((task, index) => ({ task, index })).filter(({ task }) => task.rider?.phone.replace(/\D/g, '') === normalizedPhone);
    const rider = matching[0]?.task.rider;
    return of({
      rider: rider ? { id: 1, name: rider.name, phone: rider.phone, vehiclePlate: rider.vehiclePlate, status: 'ACTIVE' } : null,
      tasks: matching.map(({ task, index }) => this.taskSummary(task, index))
    });
  }
  getTaskQr(taskNumber: string): Observable<{ taskNumber: string; qrDataUrl: string }> {
    if (!this.tasks.some(task => task.taskNumber === taskNumber)) return this.fail('ไม่พบใบงานนี้');
    // Backend QR generation is unavailable in frontend-only demo mode.
    const safeNumber = this.escapeXml(taskNumber);
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 256 256"><rect width="256" height="256" rx="20" fill="#fff"/><text x="128" y="105" text-anchor="middle" font-family="sans-serif" font-size="18" fill="#64748b">DEMO TASK</text><text x="128" y="145" text-anchor="middle" font-family="monospace" font-weight="700" font-size="17" fill="#0f172a">${safeNumber}</text><text x="128" y="180" text-anchor="middle" font-family="sans-serif" font-size="12" fill="#64748b">กรอกรหัสนี้ในหน้าของไรเดอร์</text></svg>`;
    return of({ taskNumber, qrDataUrl: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}` });
  }
  completeStop(taskNumber: string, itemId: number): Observable<CompleteStopResponse> {
    const task = this.tasks.find(item => item.taskNumber === taskNumber);
    const stop = task?.stops.find(item => item.itemId === itemId);
    if (!task || !stop) return this.fail('ไม่พบจุดส่งในใบงานนี้');
    stop.deliveryStatus = 'DELIVERED';
    const order = this.orders.find(item => item.id === stop.orderId);
    if (order) order.status = 'DELIVERED';
    const remainingStops = task.stops.filter(item => item.deliveryStatus !== 'DELIVERED').length;
    const isTaskCompleted = remainingStops === 0;
    if (isTaskCompleted) task.status = 'DELIVERED';
    this.refreshOptimizationTasks();
    return of({ message: 'บันทึกการส่งสำเร็จ (ข้อมูลตัวอย่าง)', itemId, stopSequence: stop.stopSequence, remainingStops, isTaskCompleted });
  }
  riderCheckIn(taskNumber: string, riderData: { riderName: string; riderPhone: string; vehiclePlate?: string }): Observable<{ message: string }> {
    const task = this.tasks.find(item => item.taskNumber === taskNumber);
    if (!task) return this.fail('ไม่พบใบงานนี้');
    if (!riderData.riderName.trim() || !riderData.riderPhone.trim()) return this.fail('กรุณากรอกชื่อและเบอร์โทร');
    task.rider = { name: riderData.riderName.trim(), phone: riderData.riderPhone.trim(), vehiclePlate: riderData.vehiclePlate ?? null };
    task.status = 'IN_PROGRESS';
    this.refreshOptimizationTasks();
    return of({ message: 'รับใบงานแล้ว (ข้อมูลตัวอย่าง)' });
  }

  private makeAlternative(strategy: RouteStrategy, orders: Order[], groupSize: number): OptimizationAlternative {
    const groups: Order[][] = [];
    for (let index = 0; index < orders.length; index += groupSize) groups.push(orders.slice(index, index + groupSize));
    const tasks = groups.map((group, index) => this.makeTask(group, index, strategy));
    const totalDistanceKm = this.round(tasks.reduce((sum, task) => sum + task.totalDistanceKm, 0));
    const totalBoxes = tasks.reduce((sum, task) => sum + task.totalBoxes, 0);
    const totalRevenue = tasks.reduce((sum, task) => sum + task.totalRevenue, 0);
    const totalFoodCost = tasks.reduce((sum, task) => sum + task.totalFoodCost, 0);
    const totalRiderFee = tasks.reduce((sum, task) => sum + task.deliveryFee, 0);
    const summary: OptimizationSummary = {
      totalOrders: orders.length, totalTasks: tasks.length, totalBoxes, totalDistanceKm,
      totalRevenue, totalFoodCost, totalRiderFee, netProfit: totalRevenue - totalFoodCost - totalRiderFee,
      allDeliveredOnTime: tasks.every(task => task.estimatedMinutes <= 90), departureTime: '11:30', deadlineTime: '12:30'
    };
    const labels: Record<RouteStrategy, string> = { LOWEST_COST: 'ประหยัดค่าใช้จ่าย', FASTEST: 'ส่งเร็วที่สุด', FEWEST_RIDERS: 'ใช้ไรเดอร์น้อยที่สุด' };
    return { strategy, label: labels[strategy], description: 'คำนวณจากข้อมูลตัวอย่างใน frontend', summary, tasks };
  }
  private makeTask(orders: Order[], index: number, strategy: RouteStrategy): ProposedTask {
    const now = new Date();
    const datePart = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
    const taskNumber = `TASK-${datePart}-${String(index + 1).padStart(2, '0')}`;
    const ordered = [...orders].sort((a, b) => a.customerId - b.customerId);
    let previous: { latitude: number; longitude: number } = HUB;
    let distance = 0;
    const stops: OptimizedStop[] = ordered.map((order, stopIndex) => {
      const customer = order.customer;
      const leg = this.distanceKm(previous.latitude, previous.longitude, customer.latitude, customer.longitude);
      distance += leg;
      previous = customer;
      const minutes = 8 + (stopIndex + 1) * 8;
      const hour = 11 + Math.floor((30 + minutes) / 60);
      const minute = (30 + minutes) % 60;
      return {
        itemId: order.id, orderId: order.id, stopSequence: stopIndex + 1, customerName: customer.name,
        customerPhone: customer.phone, addressDetail: customer.addressDetail,
        latitude: customer.latitude, longitude: customer.longitude, boxAmount: order.boxAmount,
        itemPrice: order.totalPrice, distanceFromPrevKm: this.round(leg),
        estArrival: `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`,
        navigationUrl: `https://www.google.com/maps/search/?api=1&query=${customer.latitude},${customer.longitude}`,
        deliveryStatus: 'PENDING'
      };
    });
    if (orders.length) distance += this.distanceKm(previous.latitude, previous.longitude, HUB.latitude, HUB.longitude);
    const totalBoxes = orders.reduce((sum, order) => sum + order.boxAmount, 0);
    const totalRevenue = orders.reduce((sum, order) => sum + order.totalPrice, 0);
    const totalFoodCost = totalBoxes * 35;
    const deliveryFee = Math.round(distance * RIDER_RATE_PER_KM);
    const estimatedMinutes = ordered.length * (strategy === 'FASTEST' ? 6 : 8) + distance * 3;
    return {
      id: index + 1, taskNumber, routeColor: ROUTE_COLORS[index % ROUTE_COLORS.length],
      totalDistanceKm: this.round(distance), estimatedMinutes: Math.round(estimatedMinutes), totalBoxes,
      deliveryFee, totalRevenue, totalFoodCost, netProfit: totalRevenue - totalFoodCost - deliveryFee,
      isLate: estimatedMinutes > 90, stops,
      waypoints: [[HUB.latitude, HUB.longitude], ...stops.map(stop => [stop.latitude, stop.longitude] as [number, number]), [HUB.latitude, HUB.longitude]]
    };
  }
  private resultFromAlternative(alternative: OptimizationAlternative, alternatives: OptimizationAlternative[]): OptimizationResult {
    return { strategy: alternative.strategy, strategyLabel: alternative.label, summary: alternative.summary, hub: { ...HUB }, tasks: this.clone(alternative.tasks), alternatives: this.clone(alternatives) };
  }
  private emptyResult(): OptimizationResult {
    const alternative = this.makeAlternative('LOWEST_COST', [], 8);
    return this.resultFromAlternative(alternative, [alternative]);
  }
  private taskDetail(task: ProposedTask, index: number): RiderTaskDetail {
    return {
      id: task.id ?? index + 1, taskNumber: task.taskNumber, departureTime: '11:30',
      totalBoxes: task.totalBoxes, totalDistance: task.totalDistanceKm, estimatedMinutes: task.estimatedMinutes,
      deliveryFee: task.deliveryFee, status: task.status ?? 'CONFIRMED', routeColor: task.routeColor,
      totalStopsCount: task.stops.length, deliveredStopsCount: task.stops.filter(stop => stop.deliveryStatus === 'DELIVERED').length,
      remainingStopsCount: task.stops.filter(stop => stop.deliveryStatus !== 'DELIVERED').length,
      ...(task.rider ? { rider: { ...task.rider } } : {}),
      stops: task.stops.map(stop => ({
        itemId: stop.itemId ?? stop.orderId, orderId: stop.orderId, stopSequence: stop.stopSequence,
        customerName: stop.customerName, customerPhone: stop.customerPhone, addressDetail: stop.addressDetail,
        latitude: stop.latitude, longitude: stop.longitude, boxAmount: stop.boxAmount,
        estArrival: stop.estArrival, deliveryStatus: stop.deliveryStatus ?? 'PENDING', navigationUrl: stop.navigationUrl
      }))
    };
  }
  private taskSummary(task: ProposedTask, index: number) {
    const deliveredStops = task.stops.filter(stop => stop.deliveryStatus === 'DELIVERED').length;
    return {
      id: task.id ?? index + 1, taskNumber: task.taskNumber, date: new Date().toISOString(),
      status: task.status ?? 'CONFIRMED', totalBoxes: task.totalBoxes, totalDistance: task.totalDistanceKm,
      deliveryFee: task.deliveryFee, totalStops: task.stops.length, deliveredStops,
      remainingStops: task.stops.length - deliveredStops
    };
  }
  private refreshOptimizationTasks(): void {
    if (!this.optimization) return;
    this.optimization.tasks = this.clone(this.tasks);
    for (const alternative of this.optimization.alternatives) {
      alternative.tasks = alternative.tasks.map(task => this.tasks.find(current => current.taskNumber === task.taskNumber) ?? task);
    }
  }
  private withCustomer(order: Order): Order {
    const customer = this.customers.find(item => item.id === order.customerId) ?? order.customer;
    return { ...order, customer: { ...customer } };
  }
  private withOrderCount(customer: Customer): Customer {
    const orders = this.orders.filter(order => order.customerId === customer.id).map(order => this.withCustomer(order));
    return { ...customer, _count: { orders: orders.length }, orders };
  }
  private clearDemoOrders(): void { this.orders = []; this.tasks = []; this.optimization = null; this.nextOrderId = 1; }
  private distanceKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const radians = (degrees: number) => degrees * Math.PI / 180;
    const dLat = radians(lat2 - lat1), dLng = radians(lng2 - lng1);
    const value = Math.sin(dLat / 2) ** 2 + Math.cos(radians(lat1)) * Math.cos(radians(lat2)) * Math.sin(dLng / 2) ** 2;
    return 6371 * 2 * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value));
  }
  private round(value: number): number { return Math.round(value * 10) / 10; }
  private clone<T>(value: T): T { return structuredClone(value); }
  private escapeXml(value: string): string {
    return value.replace(/[<>&"']/g, character => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' })[character] ?? character);
  }
  private fail<T = never>(message: string): Observable<T> { return throwError(() => ({ error: { error: message } })); }
}
