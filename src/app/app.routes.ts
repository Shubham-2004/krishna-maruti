import { Routes } from '@angular/router';
import { LandingPage } from '../landing-page/landing-page';
import { Login } from '../login/login';
import { Dashboard } from '../dashboard/dashboard';

export const routes: Routes = [
  {
    path: '',
    component: LandingPage
  },
  {
    path: 'login',
    component: Login
  },
  {
    path: 'dashboard',
    component: Dashboard
  }
];