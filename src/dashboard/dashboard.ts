import { Component, OnInit, ViewChild, ElementRef, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { Chart, registerables } from 'chart.js';

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

  // Backend API URL
  private readonly API_BASE_URL = 'https://krishna-maruti-backend.onrender.com/api';

  responses: TestResponse[] = [];
  filteredResponses: TestResponse[] = [];
  selectedResponse: TestResponse | null = null;
  isLoading: boolean = false;
  errorMessage: string = '';

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

  // Questions and correct answers (loaded from backend)
  questions: string[] = [];
  correctAnswers: string[] = [];

  // API connection status
  apiConnected = false;
  lastUpdateTime: Date | null = null;

  constructor(private http: HttpClient) {}

  ngOnInit() {
    this.checkApiHealth();
    this.loadQuestions();
    this.loadDashboardData();
  }

  ngAfterViewInit() {
    // Charts will be created after data is loaded
  }

  async checkApiHealth() {
    try {
      const response = await this.http.get<ApiResponse>(`${this.API_BASE_URL}/health`).toPromise();
      this.apiConnected = response?.success || false;
      console.log('API Health:', response);
    } catch (error) {
      console.error('API Health check failed:', error);
      this.apiConnected = false;
    }
  }

  async loadQuestions() {
    try {
      const response = await this.http.get<ApiResponse>(`${this.API_BASE_URL}/questions`).toPromise();
      if (response?.success) {
        this.questions = response.data.questions || [];
        this.correctAnswers = response.data.correctAnswers || [];
        console.log('Loaded questions:', this.questions.length);
      }
    } catch (error) {
      console.error('Error loading questions:', error);
      // Fallback questions if API fails
      this.loadFallbackQuestions();
    }
  }

  private loadFallbackQuestions() {
    this.questions = [
      "Which law states that stress is proportional to strain within the elastic limit?",
      "Which type of gear is used to transmit motion between intersecting shafts?",
      "Which cycle is used in IC engines?",
      "Unit of Power is?",
      "The hardness test performed using diamond pyramid is called?",
      "Which of the following is NOT a welding process?",
      "In thermodynamics, the SI unit of entropy is?",
      "Which metal is commonly used in aircraft manufacturing?",
      "Which of the following is a non-destructive testing method?",
      "The process of cooling a material rapidly to increase hardness is?"
    ];
    this.correctAnswers = [
      "Hooke's Law", "Bevel Gear", "Otto Cycle", "Watt", "Vickers",
      "CNC", "J/K", "Aluminium", "X-Ray Inspection", "Quenching"
    ];
  }

  async loadDashboardData() {
    this.isLoading = true;
    this.errorMessage = '';
    
    try {
      console.log('Fetching dashboard data from:', `${this.API_BASE_URL}/dashboard-stats`);
      
      const response = await this.http.get<ApiResponse>(`${this.API_BASE_URL}/dashboard-stats`).toPromise();
      
      if (response?.success) {
        const data = response.data;
        
        // Process responses with proper date conversion
        this.responses = (data.responses || []).map((r: any) => ({
          ...r,
          submissionDate: new Date(r.submissionDate || r.timestamp)
        }));
        
        // Update statistics
        this.totalResponses = data.totalResponses || 0;
        this.passedCount = data.passedCount || 0;
        this.failedCount = data.failedCount || 0;
        this.averageScore = data.averageScore || 0;
        this.departments = data.departments || [];
        this.departmentStats = data.departmentStats || [];
        
        // Update questions if provided in metadata
        if (data.metadata?.questions) {
          this.questions = data.metadata.questions;
        }
        if (data.metadata?.correctAnswers) {
          this.correctAnswers = data.metadata.correctAnswers;
        }
        
        this.lastUpdateTime = new Date();
        this.apiConnected = true;
        
        console.log('Dashboard data loaded successfully:', {
          totalResponses: this.totalResponses,
          departments: this.departments.length,
          responses: this.responses.length
        });
        
        this.applyFilters();
        
        // Create charts after a small delay to ensure DOM is ready
        setTimeout(() => {
          this.createCharts();
        }, 100);
        
      } else {
        throw new Error(response?.error || response?.message || 'Failed to load data');
      }
      
    } catch (error) {
      console.error('Error loading dashboard data:', error);
      this.errorMessage = `Failed to load data from server: ${error instanceof Error ? error.message : 'Unknown error'}`;
      this.apiConnected = false;
      
      // Load sample data as fallback
      this.loadSampleData();
    } finally {
      this.isLoading = false;
    }
  }

  // Enhanced sample data for fallback
  private loadSampleData() {
    console.log('Loading sample data as fallback...');
    
    this.responses = [
      {
        fullName: 'Shubham',
        employeeId: '123',
        dateOfBirth: '12/2/33',
        department: 'IT',
        score: 5, // Based on actual answers from your data
        answers: [
          { questionIndex: 0, selectedAnswer: "Newton's Law", isCorrect: false },
          { questionIndex: 1, selectedAnswer: "Bevel Gear", isCorrect: true },
          { questionIndex: 2, selectedAnswer: "Rankine Cycle", isCorrect: false },
          { questionIndex: 3, selectedAnswer: "Watt", isCorrect: true },
          { questionIndex: 4, selectedAnswer: "Mohs", isCorrect: false },
          { questionIndex: 5, selectedAnswer: "MIG", isCorrect: false },
          { questionIndex: 6, selectedAnswer: "Pa", isCorrect: false },
          { questionIndex: 7, selectedAnswer: "Lead", isCorrect: false },
          { questionIndex: 8, selectedAnswer: "X-Ray Inspection", isCorrect: true },
          { questionIndex: 9, selectedAnswer: "Normalizing", isCorrect: false }
        ],
        submissionDate: new Date('2025-08-16T14:10:59')
      },
      {
        fullName: 'df',
        employeeId: '2341',
        dateOfBirth: '13/02/2005',
        department: 'Mechanical',
        score: 4, // Based on actual answers from your data
        answers: [
          { questionIndex: 0, selectedAnswer: "Pascal's Law", isCorrect: false },
          { questionIndex: 1, selectedAnswer: "Bevel Gear", isCorrect: true },
          { questionIndex: 2, selectedAnswer: "Carnot Cycle", isCorrect: false },
          { questionIndex: 3, selectedAnswer: "Watt", isCorrect: true },
          { questionIndex: 4, selectedAnswer: "Vickers", isCorrect: true },
          { questionIndex: 5, selectedAnswer: "TIG", isCorrect: false },
          { questionIndex: 6, selectedAnswer: "W", isCorrect: false },
          { questionIndex: 7, selectedAnswer: "Copper", isCorrect: false },
          { questionIndex: 8, selectedAnswer: "Bend Test", isCorrect: false },
          { questionIndex: 9, selectedAnswer: "Normalizing", isCorrect: false }
        ],
        submissionDate: new Date('2025-08-16T19:07:21')
      }
    ];
    
    this.initializeData();
    this.applyFilters();
    
    setTimeout(() => {
      this.createCharts();
    }, 100);
  }

  async refreshData() {
    await this.checkApiHealth();
    await this.loadDashboardData();
  }

  initializeData() {
    this.totalResponses = this.responses.length;
    this.passedCount = this.responses.filter(r => r.score >= 6).length;
    this.failedCount = this.totalResponses - this.passedCount;
    this.averageScore = this.totalResponses > 0 ? 
      this.responses.reduce((sum, r) => sum + r.score, 0) / this.totalResponses : 0;
    this.departments = [...new Set(this.responses.map(r => r.department).filter(d => d))];
    
    // Calculate department stats if not provided by API
    if (this.departmentStats.length === 0) {
      this.departmentStats = this.departments.map(dept => {
        const deptResponses = this.responses.filter(r => r.department === dept);
        const passed = deptResponses.filter(r => r.score >= 6).length;
        const avgScore = deptResponses.reduce((sum, r) => sum + r.score, 0) / deptResponses.length;
        
        return {
          name: dept,
          totalCandidates: deptResponses.length,
          passed,
          failed: deptResponses.length - passed,
          averageScore: Math.round(avgScore * 10) / 10
        };
      });
    }
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
            text: 'Score Distribution Analysis'
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
            text: 'Pass/Fail Distribution'
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
      alert(`Generating certificate for ${response.fullName}`);
      // TODO: Implement actual certificate generation
    } else {
      alert(`${response.fullName} did not pass the test (Score: ${response.score}/10). Certificate not available.`);
    }
  }

  exportData() {
    const csvContent = this.generateCSV();
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `mechanical-trainee-test-results-${new Date().toISOString().split('T')[0]}.csv`;
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
}