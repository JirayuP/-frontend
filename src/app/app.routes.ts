import { Routes } from '@angular/router';
import { DispatcherComponent } from './components/dispatcher/dispatcher.component.js';
import { RiderComponent } from './components/rider/rider.component.js';

export const routes: Routes = [
  { path: '', component: DispatcherComponent },
  { path: 'rider', component: RiderComponent },
  { path: 'rider/:taskNumber', component: RiderComponent },
  { path: '**', redirectTo: '' }
];
