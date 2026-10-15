import { Routes } from '@angular/router';
import { DispatcherComponent } from './components/dispatcher/dispatcher.js';
import { RiderComponent } from './components/rider/rider.js';
import { ManagementComponent } from './components/management/management.js';

export const routes: Routes = [
  { path: '', component: DispatcherComponent },
  { path: 'manage', component: ManagementComponent },
  { path: 'rider', component: RiderComponent },
  { path: 'rider/:taskNumber', component: RiderComponent },
  { path: '**', redirectTo: '' }
];
