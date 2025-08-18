import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-login',
  imports: [FormsModule, CommonModule],
  templateUrl: './login.html',
  styleUrl: './login.css'
})
export class Login {
  username: string = '';
  empId: string = '';
  errorMessage: string = '';
  successMessage: string = '';

  // Default credentials for validation (hidden from user)
  private readonly validUsername = 'Chandan Bera';
  private readonly validEmpId = '12340987';

  constructor(private router: Router) {}

  onLogin() {
    this.errorMessage = '';
    this.successMessage = '';

    // Validate credentials
    if (this.username === this.validUsername && this.empId === this.validEmpId) {
      this.successMessage = 'Login successful! Redirecting...';
      
      // Simulate loading and redirect to dashboard
      setTimeout(() => {
        this.router.navigate(['/dashboard']);
      }, 1500);
    } else {
      this.errorMessage = 'Invalid username or employee ID. Please check your credentials.';
    }
  }
}