import { Component, OnInit, ViewChild, ElementRef, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Chart, registerables } from 'chart.js';
import { timeout, retry, catchError } from 'rxjs/operators';
import { of, throwError } from 'rxjs';

Chart.register(...registerables);

interface TestResponse {
  fullName: string;
  employeeId: string;
  dateOfBirth: string;
  department: string;
  score: number;
  answers: Array<{
    questionIndex: number;
    selectedAnswer: string;
    isCorrect: boolean;
  }>;
  submissionDate: Date;
  timestamp?: string;
  originalScore?: string;
}

interface DepartmentStats {
  name: string;
  totalCandidates: number;
  passed: number;
  failed: number;
  averageScore: number;
  passPercentage: number;
}

interface ApiResponse {
  success: boolean;
  data: any;
  message?: string;
  error?: string;
  metadata?: any;
}

@Component({
  selector: 'app-dashboard',
  imports: [CommonModule, FormsModule],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.css'
})
export class Dashboard implements OnInit, AfterViewInit {
  @ViewChild('scoreChart') scoreChartRef!: ElementRef;
  @ViewChild('passFailChart') passFailChartRef!: ElementRef;

  // Production-only backend URL
  private readonly API_URL = 'https://krishna-maruti-backend.onrender.com/api';

  responses: TestResponse[] = [];
  filteredResponses: TestResponse[] = [];
  selectedResponse: TestResponse | null = null;
  isLoading: boolean = false;
  errorMessage: string = '';
  connectionAttempts = 0;
  maxRetries = 5; // Increased for Render cold starts

  // Filter properties
  selectedDepartment = '';
  selectedScoreRange = '';
  selectedStatus = '';
  searchTerm = '';

  // Pagination
  currentPage = 1;
  itemsPerPage = 10;
  totalPages = 1;

  // Statistics
  totalResponses = 0;
  passedCount = 0;
  failedCount = 0;
  averageScore = 0;
  departments: string[] = [];
  departmentStats: DepartmentStats[] = [];

  // Charts
  scoreChart: Chart | null = null;
  passFailChart: Chart | null = null;

  // Questions and correct answers (loaded from backend only)
  questions: string[] = [];
  correctAnswers: string[] = [];

  // API connection status
  apiConnected = false;
  lastUpdateTime: Date | null = null;
  isRetrying = false;
  serverStatus = 'Initializing...';

  // Backend metadata
  backendMetadata: any = null;

  constructor(private http: HttpClient) {}

  ngOnInit() {
    this.initializeConnection();
  }

  ngAfterViewInit() {
    // Charts will be created after data is loaded from backend
  }

  async initializeConnection() {
    this.isLoading = true;
    this.errorMessage = '';
    this.serverStatus = 'Connecting to production server...';
    
    console.log('🔄 Initializing connection to production backend...');
    console.log('🌐 Backend URL:', this.API_URL);
    
    // Wake up server and load data
    await this.wakeUpServer();
    await this.checkApiHealth();
    await this.loadQuestions();
    await this.loadDashboardData();
  }

  async wakeUpServer() {
    console.log('🔔 Waking up Render production server...');
    this.isRetrying = true;
    this.serverStatus = 'Waking up production server (this may take 30-60 seconds)...';
    
    try {
      // Make multiple wake-up requests
      const wakeUpRequests = [
        this.http.get(`${this.API_URL}/ping`).pipe(timeout(60000), catchError(() => of(null))).toPromise(),
        this.http.get(`${this.API_URL}/health`).pipe(timeout(60000), catchError(() => of(null))).toPromise()
      ];

      await Promise.allSettled(wakeUpRequests);
      console.log('✅ Production server wake up completed');
      this.serverStatus = 'Server awakened, loading data...';
      
    } catch (error) {
      console.log('⚠️ Server wake up had issues, but continuing...');
      this.serverStatus = 'Server wake up completed, attempting data load...';
    } finally {
      this.isRetrying = false;
    }
  }

  async checkApiHealth() {
    try {
      console.log('🏥 Checking production API health...');
      this.serverStatus = 'Checking server health...';
      
      const response = await this.http.get<ApiResponse>(`${this.API_URL}/health`).pipe(
        timeout(45000), // 45 seconds timeout for health check
        retry(3),
        catchError(this.handleError.bind(this))
      ).toPromise();
      
      if (response?.success) {
        this.apiConnected = true;
        this.backendMetadata = response;
        this.serverStatus = 'Connected to production server';
        console.log('✅ Production API Health check successful:', response);
      } else {
        throw new Error('Health check failed');
      }
      
    } catch (error) {
      console.error('❌ Production API Health check failed:', error);
      this.apiConnected = false;
      this.serverStatus = 'Health check failed';
      throw error;
    }
  }

  async loadQuestions() {
    try {
      console.log('📚 Loading questions from production backend...');
      this.serverStatus = 'Loading questions from server...';
      
      const response = await this.http.get<ApiResponse>(`${this.API_URL}/questions`).pipe(
        timeout(30000),
        retry(3),
        catchError(this.handleError.bind(this))
      ).toPromise();
      
      if (response?.success && response.data) {
        this.questions = response.data.questions || [];
        this.correctAnswers = response.data.correctAnswers || [];
        console.log('✅ Questions loaded from production:', this.questions.length);
        this.serverStatus = 'Questions loaded successfully';
      } else {
        throw new Error('Failed to load questions from backend');
      }
      
    } catch (error) {
      console.error('❌ Error loading questions from production backend:', error);
      this.serverStatus = 'Failed to load questions';
      throw error;
    }
  }

  async loadDashboardData() {
    this.isLoading = true;
    this.errorMessage = '';
    
    try {
      console.log('📊 Fetching dashboard data from production backend...');
      this.serverStatus = 'Loading dashboard data...';
      
      const response = await this.http.get<ApiResponse>(`${this.API_URL}/dashboard-stats`).pipe(
        timeout(60000), // 60 seconds timeout for dashboard data
        retry(3),
        catchError(this.handleError.bind(this))
      ).toPromise();
      
      if (response?.success && response.data) {
        const data = response.data;
        
        // Process responses with proper date conversion
        this.responses = (data.responses || []).map((r: any) => ({
          ...r,
          submissionDate: new Date(r.submissionDate || r.timestamp || new Date())
        }));
        
        // Update statistics from backend
        this.totalResponses = data.totalResponses || 0;
        this.passedCount = data.passedCount || 0;
        this.failedCount = data.failedCount || 0;
        this.averageScore = data.averageScore || 0;
        this.departments = data.departments || [];
        this.departmentStats = data.departmentStats || [];
        
        // Update questions from metadata if available
        if (data.metadata?.questions) {
          this.questions = data.metadata.questions;
        }
        if (data.metadata?.correctAnswers) {
          this.correctAnswers = data.metadata.correctAnswers;
        }
        
        // Store backend metadata
        this.backendMetadata = data.metadata;
        
        this.lastUpdateTime = new Date();
        this.apiConnected = true;
        this.connectionAttempts = 0;
        this.serverStatus = `Data loaded successfully (${this.totalResponses} responses)`;
        
        console.log('✅ Production dashboard data loaded successfully:', {
          totalResponses: this.totalResponses,
          departments: this.departments.length,
          responses: this.responses.length,
          cacheStatus: data.metadata?.cacheStatus,
          renderUrl: data.metadata?.renderUrl
        });
        
        this.applyFilters();
        
        // Create charts after DOM is ready
        setTimeout(() => {
          this.createCharts();
        }, 100);
        
      } else {
        throw new Error(response?.error || response?.message || 'No data received from backend');
      }
      
    } catch (error) {
      console.error('❌ Error loading dashboard data from production:', error);
      this.connectionAttempts++;
      
      if (this.connectionAttempts < this.maxRetries) {
        this.serverStatus = `Connection attempt ${this.connectionAttempts}/${this.maxRetries}...`;
        this.errorMessage = `Production server is starting up... Attempt ${this.connectionAttempts}/${this.maxRetries}. Please wait.`;
        
        // Progressive retry delays
        const retryDelay = Math.min(5000 + (this.connectionAttempts * 3000), 15000);
        console.log(`⏳ Retrying in ${retryDelay/1000} seconds...`);
        
        setTimeout(() => {
          this.loadDashboardData();
        }, retryDelay);
        
      } else {
        this.apiConnected = false;
        this.serverStatus = 'Failed to connect to production server';
        this.errorMessage = 'Unable to connect to production server after multiple attempts. Please check your internet connection or try again later.';
        console.error('❌ Max retry attempts reached. Cannot load data from production backend.');
      }
    } finally {
      if (this.connectionAttempts >= this.maxRetries || this.apiConnected) {
        this.isLoading = false;
      }
    }
  }

  private handleError(error: HttpErrorResponse) {
    console.error('Production HTTP Error:', error);
    
    if (error.status === 504 || error.status === 502) {
      return throwError(() => new Error('Production server is starting up, please wait...'));
    } else if (error.status === 0) {
      return throwError(() => new Error('Network connection to production server failed'));
    } else if (error.status >= 500) {
      return throwError(() => new Error(`Production server error: ${error.status}`));
    } else {
      return throwError(() => new Error(`Connection error: ${error.message}`));
    }
  }

  async refreshData() {
    console.log('🔄 Manually refreshing data from production backend...');
    this.connectionAttempts = 0;
    this.errorMessage = '';
    this.serverStatus = 'Refreshing...';
    
    // Clear cache on backend first
    try {
      await this.http.post(`${this.API_URL}/clear-cache`, {}).pipe(
        timeout(10000),
        catchError(() => of(null))
      ).toPromise();
      console.log('🗑️ Backend cache cleared');
    } catch (error) {
      console.log('⚠️ Cache clear failed, but continuing...');
    }
    
    await this.initializeConnection();
  }

  applyFilters() {
    this.filteredResponses = this.responses.filter(response => {
      let matches = true;

      if (this.selectedDepartment && response.department !== this.selectedDepartment) {
        matches = false;
      }

      if (this.selectedScoreRange) {
        const [min, max] = this.selectedScoreRange.split('-').map(Number);
        if (response.score < min || response.score > max) {
          matches = false;
        }
      }

      if (this.selectedStatus) {
        const passed = response.score >= 6;
        if ((this.selectedStatus === 'passed' && !passed) || 
            (this.selectedStatus === 'failed' && passed)) {
          matches = false;
        }
      }

      if (this.searchTerm) {
        const searchLower = this.searchTerm.toLowerCase();
        if (!response.fullName.toLowerCase().includes(searchLower) && 
            !response.employeeId.toLowerCase().includes(searchLower)) {
          matches = false;
        }
      }

      return matches;
    });

    this.totalPages = Math.ceil(this.filteredResponses.length / this.itemsPerPage);
    this.currentPage = 1;
  }

  createCharts() {
    if (this.responses.length === 0) {
      console.log('⚠️ No data available for charts');
      return;
    }

    // Destroy existing charts
    if (this.scoreChart) {
      this.scoreChart.destroy();
      this.scoreChart = null;
    }
    if (this.passFailChart) {
      this.passFailChart.destroy();
      this.passFailChart = null;
    }
    
    this.createScoreDistributionChart();
    this.createPassFailChart();
  }

  createScoreDistributionChart() {
    if (!this.scoreChartRef?.nativeElement) {
      console.log('Score chart element not available');
      return;
    }
    
    const ctx = this.scoreChartRef.nativeElement.getContext('2d');
    
    // Group scores into ranges
    const scoreRanges = {
      '0-2': 0, '3-4': 0, '5-6': 0, '7-8': 0, '9-10': 0
    };

    this.responses.forEach(response => {
      if (response.score <= 2) scoreRanges['0-2']++;
      else if (response.score <= 4) scoreRanges['3-4']++;
      else if (response.score <= 6) scoreRanges['5-6']++;
      else if (response.score <= 8) scoreRanges['7-8']++;
      else scoreRanges['9-10']++;
    });

    this.scoreChart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: Object.keys(scoreRanges),
        datasets: [{
          label: 'Number of Candidates',
          data: Object.values(scoreRanges),
          backgroundColor: [
            '#ef4444', '#f97316', '#eab308', '#22c55e', '#059669'
          ],
          borderColor: [
            '#dc2626', '#ea580c', '#ca8a04', '#16a34a', '#047857'
          ],
          borderWidth: 1
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          y: {
            beginAtZero: true,
            ticks: {
              stepSize: 1
            }
          }
        },
        plugins: {
          title: {
            display: true,
            text: 'Score Distribution Analysis (Production Data)'
          }
        }
      }
    });
  }

  createPassFailChart() {
    if (!this.passFailChartRef?.nativeElement) {
      console.log('Pass/Fail chart element not available');
      return;
    }
    
    const ctx = this.passFailChartRef.nativeElement.getContext('2d');
    
    this.passFailChart = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: ['Passed (≥6)', 'Failed (<6)'],
        datasets: [{
          data: [this.passedCount, this.failedCount],
          backgroundColor: ['#22c55e', '#ef4444'],
          borderColor: ['#16a34a', '#dc2626'],
          borderWidth: 2
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'bottom'
          },
          title: {
            display: true,
            text: 'Pass/Fail Distribution (Production Data)'
          }
        }
      }
    });
  }

  viewDetails(response: TestResponse) {
    this.selectedResponse = response;
  }

  closeDetails() {
    this.selectedResponse = null;
  }

  getQuestionText(index: number): string {
    return this.questions[index] || `Question ${index + 1}`;
  }

  getDepartmentStats(department: string): DepartmentStats | null {
    return this.departmentStats.find(d => d.name === department) || null;
  }

  downloadCertificate(response: TestResponse) {
    if (response.score >= 6) {
      alert(`Generating certificate for ${response.fullName} (Score: ${response.score}/10)`);
      // TODO: Implement actual certificate generation
    } else {
      alert(`${response.fullName} did not pass the test (Score: ${response.score}/10). Certificate not available.`);
    }
  }

  exportData() {
    if (this.filteredResponses.length === 0) {
      alert('No data available to export. Please ensure you are connected to the backend.');
      return;
    }

    const csvContent = this.generateCSV();
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `krishna-maruti-test-results-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  }

  private generateCSV(): string {
    const headers = [
      'Name', 'Employee ID', 'Department', 'DOB', 'Score', 'Status', 
      'Submission Date', 'Detailed Answers'
    ];
    
    const rows = this.filteredResponses.map(r => [
      r.fullName,
      r.employeeId,
      r.department,
      r.dateOfBirth,
      r.score.toString(),
      r.score >= 6 ? 'Passed' : 'Failed',
      r.submissionDate.toLocaleDateString(),
      r.answers.map((a, i) => 
        `Q${i+1}: ${a.selectedAnswer} (${a.isCorrect ? 'Correct' : 'Wrong'})`
      ).join('; ')
    ]);
    
    return [headers, ...rows]
      .map(row => row.map(cell => `"${cell}"`).join(','))
      .join('\n');
  }

  // Pagination methods
  get startIndex(): number {
    return (this.currentPage - 1) * this.itemsPerPage;
  }

  get endIndex(): number {
    return Math.min(this.startIndex + this.itemsPerPage, this.filteredResponses.length);
  }

  get paginatedResponses(): TestResponse[] {
    return this.filteredResponses.slice(this.startIndex, this.endIndex);
  }

  previousPage() {
    if (this.currentPage > 1) {
      this.currentPage--;
    }
  }

  nextPage() {
    if (this.currentPage < this.totalPages) {
      this.currentPage++;
    }
  }

  goToPage(page: number) {
    if (page >= 1 && page <= this.totalPages) {
      this.currentPage = page;
    }
  }

  getPageNumbers(): number[] {
    const pages = [];
    const maxPages = Math.min(5, this.totalPages);
    let start = Math.max(1, this.currentPage - Math.floor(maxPages / 2));
    let end = Math.min(this.totalPages, start + maxPages - 1);
    
    if (end - start + 1 < maxPages) {
      start = Math.max(1, end - maxPages + 1);
    }
    
    for (let i = start; i <= end; i++) {
      pages.push(i);
    }
    return pages;
  }

  // Utility methods
  formatDate(date: Date): string {
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
  }

  getPassPercentage(): number {
    return this.totalResponses > 0 ? Math.round((this.passedCount / this.totalResponses) * 100) : 0;
  }

  // Status indicators
  getConnectionStatus(): string {
    return this.serverStatus;
  }

  getConnectionClass(): string {
    if (this.isRetrying || (this.isLoading && this.connectionAttempts > 0)) {
      return 'text-yellow-600';
    }
    if (this.apiConnected && this.responses.length > 0) {
      return 'text-green-600';
    }
    if (!this.apiConnected) {
      return 'text-red-600';
    }
    return 'text-orange-600';
  }

  // Backend information methods
  getBackendInfo(): any {
    return this.backendMetadata || {};
  }

  getCacheStatus(): string {
    return this.backendMetadata?.cacheStatus || 'Unknown';
  }

  getRenderUrl(): string {
    return this.backendMetadata?.renderUrl || this.API_URL;
  }

  getLastUpdateInfo(): string {
    if (this.lastUpdateTime) {
      const timeDiff = Math.floor((Date.now() - this.lastUpdateTime.getTime()) / 1000);
      if (timeDiff < 60) return `${timeDiff} seconds ago`;
      if (timeDiff < 3600) return `${Math.floor(timeDiff / 60)} minutes ago`;
      return `${Math.floor(timeDiff / 3600)} hours ago`;
    }
    return 'Never';
  }

  // Connection test method
  async testConnection() {
    try {
      this.serverStatus = 'Testing connection...';
      const response = await this.http.get<ApiResponse>(`${this.API_URL}/test-connection`).pipe(
        timeout(30000),
        retry(1)
      ).toPromise();
      
      if (response?.success) {
        this.serverStatus = 'Connection test successful';
        alert('✅ Connection to production backend successful!');
      } else {
        throw new Error('Connection test failed');
      }
    } catch (error) {
      this.serverStatus = 'Connection test failed';
      alert('❌ Connection test failed. Please check your internet connection.');
    }
  }
}
