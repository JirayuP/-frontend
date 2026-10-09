export interface Customer {
  id: number;
  name: string;
  phone: string;
  addressDetail: string;
  latitude: number;
  longitude: number;
  _count?: { orders: number };
  orders?: Order[];
}

export interface Order {
  id: number;
  customerId: number;
  boxAmount: number;
  totalPrice: number;
  status: 'PENDING' | 'ASSIGNED' | 'DELIVERED' | 'CANCELLED';
  createdAt: string;
  customer: Customer;
  taskItem?: {
    task: {
      taskNumber: string;
      routeColor: string;
    }
  };
}

export interface OptimizedStop {
  orderId: number;
  stopSequence: number;
  customerName: string;
  customerPhone: string;
  addressDetail: string;
  latitude: number;
  longitude: number;
  boxAmount: number;
  itemPrice: number;
  distanceFromPrevKm: number;
  estArrival: string;
  navigationUrl: string;
}

export interface ProposedTask {
  id?: number;
  taskNumber: string;
  routeColor: string;
  totalDistanceKm: number;
  estimatedMinutes: number;
  totalBoxes: number;
  deliveryFee: number;
  totalRevenue: number;
  totalFoodCost: number;
  netProfit: number;
  isLate: boolean;
  stops: OptimizedStop[];
  waypoints: [number, number][];
}

export type RouteStrategy = 'LOWEST_COST' | 'FASTEST' | 'FEWEST_RIDERS';

export interface OptimizationSummary {
  totalOrders: number;
  totalTasks: number;
  totalBoxes: number;
  totalDistanceKm: number;
  totalRevenue: number;
  totalFoodCost: number;
  totalRiderFee: number;
  netProfit: number;
  allDeliveredOnTime: boolean;
  departureTime: string;
  deadlineTime: string;
}

export interface OptimizationAlternative {
  strategy: RouteStrategy;
  label: string;
  description: string;
  summary: OptimizationSummary;
  tasks: ProposedTask[];
}

export interface OptimizationResult {
  strategy: RouteStrategy;
  strategyLabel: string;
  summary: OptimizationSummary;
  hub: {
    name: string;
    latitude: number;
    longitude: number;
    radiusKm: number;
  };
  tasks: ProposedTask[];
  alternatives: OptimizationAlternative[];
}

export interface ConfirmTasksResponse {
  message: string;
  result: OptimizationResult;
}

export interface CustomerListResponse {
  count: number;
  customers: Customer[];
}

export interface CustomerMutationResponse {
  message: string;
  customer: Customer;
}

export interface OrderMutationResponse {
  message: string;
  order: Order;
}

export interface RiderTaskDetail {
  id: number;
  taskNumber: string;
  departureTime: string;
  totalBoxes: number;
  totalDistance: number;
  estimatedMinutes: number;
  deliveryFee: number;
  status: string;
  routeColor: string;
  totalStopsCount?: number;
  rider?: {
    name: string;
    phone: string;
    vehiclePlate: string;
  };
  stops: {
    itemId: number;
    orderId: number;
    stopSequence: number;
    customerName: string;
    customerPhone: string;
    addressDetail: string;
    latitude: number;
    longitude: number;
    boxAmount: number;
    estArrival: string;
    deliveryStatus: 'PENDING' | 'DELIVERED' | 'FAILED';
    navigationUrl: string;
  }[];
}
