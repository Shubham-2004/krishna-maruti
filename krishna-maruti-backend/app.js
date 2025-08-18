const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors({
  origin: ['http://localhost:4200', 'http://localhost:3000'],
  credentials: true
}));
app.use(express.json());

// Google Sheets Configuration
const SHEET_ID = '1yjOEf3aBN-MBKuUY1ypyrxRo5x2mqH3WAFZlz3aPbls';

// These will be populated from the first employee's answers
let CORRECT_ANSWERS = [];
let QUESTIONS = [];

// Helper function to fetch data using CSV export
async function fetchDataFromCSV() {
  try {
    console.log('📥 Fetching data using CSV export method...');
    
    const fetch = (await import('node-fetch')).default;
    const csvUrl = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=0`;
    
    console.log('🔗 CSV URL:', csvUrl);
    
    const response = await fetch(csvUrl);
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const csvData = await response.text();
    console.log('📄 CSV data fetched successfully');
    
    // Parse CSV data - improved parsing to handle quoted fields
    const lines = csvData.split('\n').filter(line => line.trim());
    const rows = lines.map(line => {
      const result = [];
      let current = '';
      let inQuotes = false;
      
      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
          inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
          result.push(current.trim());
          current = '';
        } else {
          current += char;
        }
      }
      result.push(current.trim()); // Add the last field
      
      return result;
    });
    
    console.log('📊 Parsed rows:', rows.length);
    return rows;
    
  } catch (error) {
    console.error('❌ Error fetching CSV data:', error);
    throw error;
  }
}

// Helper function to initialize correct answers from first employee
function initializeCorrectAnswers(rows) {
  if (!rows || rows.length < 2) {
    console.log('⚠️ Insufficient data to initialize correct answers');
    return false;
  }
  
  const headerRow = rows[0];
  const firstEmployeeRow = rows[1]; // Second row is first employee (after header)
  
  console.log('📋 Header row:', headerRow.slice(6, 16));
  console.log('👤 First employee row:', firstEmployeeRow.slice(6, 16));
  
  // Extract questions from header (columns 6-15)
  QUESTIONS = headerRow.slice(6, 16).map(q => {
    // Remove question number prefix (e.g., "1. " from "1. Which law...")
    return q.replace(/^\d+\.\s*/, '').trim();
  });
  
  // Extract correct answers from first employee (columns 6-15)
  CORRECT_ANSWERS = firstEmployeeRow.slice(6, 16).map(answer => answer?.trim() || '');
  
  console.log('✅ Initialized from first employee:');
  console.log('📝 Questions loaded:', QUESTIONS.length);
  console.log('✔️ Correct answers loaded:', CORRECT_ANSWERS.length);
  console.log('👨‍💼 First employee name:', firstEmployeeRow[2]);
  
  // Log the Q&A mapping for verification
  QUESTIONS.forEach((question, index) => {
    console.log(`   Q${index + 1}: ${question.substring(0, 50)}... → ${CORRECT_ANSWERS[index]}`);
  });
  
  return true;
}

// Helper function to check if answer is correct (comparing with first employee)
function isAnswerCorrect(userAnswer, questionIndex) {
  if (questionIndex >= CORRECT_ANSWERS.length || !userAnswer) return false;
  
  const normalizedUserAnswer = userAnswer.toLowerCase().trim();
  const normalizedCorrectAnswer = CORRECT_ANSWERS[questionIndex].toLowerCase().trim();
  
  return normalizedUserAnswer === normalizedCorrectAnswer;
}

// Helper function to map row data to test response
function mapRowToTestResponse(row, isFirstEmployee = false) {
  if (!row || row.length < 6) {
    return null;
  }
  
  const timestamp = row[0] || '';
  const scoreFromSheet = row[1] || '';
  const fullName = row[2]?.trim() || '';
  const employeeId = row[3]?.trim() || '';
  const dateOfBirth = row[4]?.trim() || '';
  const department = row[5]?.trim() || '';
  
  if (!fullName) {
    return null;
  }
  
  // Extract answers from columns 6-15 (Q1-Q10)
  const userAnswers = row.slice(6, 16);
  const answers = userAnswers.map((answer, index) => ({
    questionIndex: index,
    selectedAnswer: answer?.trim() || '',
    isCorrect: isFirstEmployee ? true : isAnswerCorrect(answer?.trim() || '', index) // First employee is always 100% correct
  }));
  
  // Calculate score
  const calculatedScore = answers.filter(a => a.isCorrect).length;
  
  // Parse submission date
  let submissionDate;
  try {
    submissionDate = new Date(timestamp);
    if (isNaN(submissionDate.getTime())) {
      submissionDate = new Date();
    }
  } catch (error) {
    submissionDate = new Date();
  }
  
  const testResponse = {
    fullName,
    employeeId,
    dateOfBirth,
    department,
    score: calculatedScore,
    answers,
    submissionDate,
    originalScore: scoreFromSheet,
    timestamp,
    isReferenceEmployee: isFirstEmployee
  };
  
  if (isFirstEmployee) {
    console.log(`⭐ Reference Employee: ${fullName} - Score: ${calculatedScore}/10 (100% by definition)`);
  } else {
    console.log(`👤 Employee: ${fullName} - Score: ${calculatedScore}/10 (${(calculatedScore/10*100).toFixed(0)}%)`);
  }
  
  return testResponse;
}

// Helper function to process sheet data
function processSheetData(rows) {
  if (!rows || rows.length <= 1) {
    console.log('⚠️ No data rows to process');
    return [];
  }
  
  // Initialize correct answers from first employee
  const initialized = initializeCorrectAnswers(rows);
  if (!initialized) {
    console.log('❌ Failed to initialize correct answers');
    return [];
  }
  
  const dataRows = rows.slice(1); // Skip header row
  console.log('📊 Processing', dataRows.length, 'employee rows');
  
  const testResponses = [];
  
  for (let i = 0; i < dataRows.length; i++) {
    const row = dataRows[i];
    const isFirstEmployee = i === 0; // First data row is our reference
    const testResponse = mapRowToTestResponse(row, isFirstEmployee);
    
    if (testResponse) {
      testResponses.push(testResponse);
    }
  }
  
  console.log(`✅ Successfully processed ${testResponses.length} responses`);
  console.log(`⭐ Reference employee: ${testResponses[0]?.fullName} (100% correct by definition)`);
  
  return testResponses;
}

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    message: 'Krishna Maruti Backend API is running (Dynamic CSV Mode)',
    timestamp: new Date().toISOString(),
    config: {
      method: 'CSV Export with Dynamic Correct Answers',
      sheetId: SHEET_ID,
      questionsLoaded: QUESTIONS.length,
      correctAnswersLoaded: CORRECT_ANSWERS.length,
      referenceEmployee: CORRECT_ANSWERS.length > 0 ? 'First employee in data' : 'Not loaded yet'
    }
  });
});

// Test connection using CSV method
app.get('/api/test-connection', async (req, res) => {
  try {
    console.log('🧪 Testing CSV connection...');
    
    const rows = await fetchDataFromCSV();
    const initialized = initializeCorrectAnswers(rows);
    
    res.json({
      success: true,
      message: 'CSV connection successful with dynamic correct answers',
      details: {
        method: 'CSV Export with First Employee as Reference',
        totalRows: rows.length,
        headerRow: rows[0]?.slice(0, 6) || [], // Show first 6 columns
        firstEmployeeData: rows[1]?.slice(0, 6) || [], // Show first 6 columns
        questionsExtracted: QUESTIONS.length,
        correctAnswersExtracted: CORRECT_ANSWERS.length,
        referenceEmployee: rows[1]?.[2] || 'Unknown'
      }
    });

  } catch (error) {
    console.error('❌ CSV connection test failed:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to connect via CSV',
      message: error.message,
      instructions: [
        '1. Open your Google Sheet',
        '2. Click Share button',
        '3. Change access to "Anyone with the link can view"',
        '4. Ensure the sheet is publicly accessible',
        '5. Make sure first employee has the correct answers'
      ]
    });
  }
});

// Get all test responses using CSV
app.get('/api/test-responses', async (req, res) => {
  try {
    console.log('📊 Fetching test responses using CSV...');
    
    const rows = await fetchDataFromCSV();
    const testResponses = processSheetData(rows);

    res.json({
      success: true,
      data: testResponses,
      totalCount: testResponses.length,
      timestamp: new Date().toISOString(),
      metadata: {
        method: 'CSV Export with Dynamic Correct Answers',
        headerRow: rows[0] || [],
        totalRows: rows.length,
        processedRows: testResponses.length,
        referenceEmployee: testResponses[0]?.fullName || 'Unknown',
        questionsFromHeader: QUESTIONS.length,
        answersFromFirstEmployee: CORRECT_ANSWERS.length
      }
    });

  } catch (error) {
    console.error('❌ Error fetching CSV data:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch data via CSV',
      message: error.message
    });
  }
});

// Get dashboard statistics using CSV
app.get('/api/dashboard-stats', async (req, res) => {
  try {
    console.log('📈 Fetching dashboard stats using CSV...');
    
    const rows = await fetchDataFromCSV();
    const testResponses = processSheetData(rows);
    
    if (testResponses.length === 0) {
      return res.json({
        success: true,
        data: {
          totalResponses: 0,
          passedCount: 0,
          failedCount: 0,
          averageScore: 0,
          departments: [],
          departmentStats: [],
          responses: [],
          referenceEmployee: null
        }
      });
    }

    // Calculate statistics
    const totalResponses = testResponses.length;
    const passedCount = testResponses.filter(r => r.score >= 6).length;
    const failedCount = totalResponses - passedCount;
    const averageScore = testResponses.reduce((sum, r) => sum + r.score, 0) / totalResponses;
    const departments = [...new Set(testResponses.map(r => r.department).filter(d => d))];

    // Department statistics
    const departmentStats = departments.map(dept => {
      const deptResponses = testResponses.filter(r => r.department === dept);
      const deptPassed = deptResponses.filter(r => r.score >= 6).length;
      const deptAverage = deptResponses.reduce((sum, r) => sum + r.score, 0) / deptResponses.length;
      
      return {
        name: dept,
        totalCandidates: deptResponses.length,
        passed: deptPassed,
        failed: deptResponses.length - deptPassed,
        averageScore: Math.round(deptAverage * 10) / 10
      };
    });

    const stats = {
      totalResponses,
      passedCount,
      failedCount,
      averageScore: Math.round(averageScore * 10) / 10,
      departments,
      departmentStats,
      responses: testResponses,
      referenceEmployee: testResponses[0], // First employee is reference
      metadata: {
        method: 'CSV Export with Dynamic Correct Answers',
        questions: QUESTIONS,
        correctAnswers: CORRECT_ANSWERS,
        referenceEmployeeName: testResponses[0]?.fullName || 'Unknown'
      }
    };

    console.log('📊 Statistics calculated:', {
      totalResponses: stats.totalResponses,
      passedCount: stats.passedCount,
      failedCount: stats.failedCount,
      averageScore: stats.averageScore,
      departments: stats.departments.length,
      referenceEmployee: stats.referenceEmployee?.fullName
    });

    res.json({
      success: true,
      data: stats
    });

  } catch (error) {
    console.error('❌ Error fetching dashboard stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch dashboard statistics',
      message: error.message
    });
  }
});

// Get questions and correct answers (dynamically loaded)
app.get('/api/questions', (req, res) => {
  res.json({
    success: true,
    data: {
      questions: QUESTIONS,
      correctAnswers: CORRECT_ANSWERS,
      totalQuestions: QUESTIONS.length,
      source: 'Dynamically loaded from first employee',
      referenceNote: 'Questions from header row, correct answers from first employee'
    }
  });
});

// Get detailed comparison with reference employee
app.get('/api/response/:employeeId', async (req, res) => {
  try {
    const employeeId = req.params.employeeId;
    console.log('🔍 Fetching details for employee:', employeeId);
    
    const rows = await fetchDataFromCSV();
    const testResponses = processSheetData(rows);
    const targetResponse = testResponses.find(r => r.employeeId === employeeId);
    
    if (!targetResponse) {
      return res.status(404).json({
        success: false,
        message: 'Employee not found'
      });
    }

    const referenceEmployee = testResponses[0]; // First employee is reference

    res.json({
      success: true,
      data: {
        ...targetResponse,
        referenceEmployee: referenceEmployee,
        comparisonAnalysis: targetResponse.answers.map((answer, index) => ({
          questionNumber: index + 1,
          question: QUESTIONS[index],
          userAnswer: answer.selectedAnswer,
          referenceAnswer: CORRECT_ANSWERS[index],
          isCorrect: answer.isCorrect,
          referenceEmployeeName: referenceEmployee.fullName
        })),
        summary: {
          totalQuestions: QUESTIONS.length,
          correctAnswers: targetResponse.answers.filter(a => a.isCorrect).length,
          scorePercentage: Math.round((targetResponse.score / QUESTIONS.length) * 100),
          comparedWith: referenceEmployee.fullName
        }
      }
    });

  } catch (error) {
    console.error('❌ Error fetching employee data:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch employee data',
      message: error.message
    });
  }
});

// Get raw data for debugging
app.get('/api/debug/raw-data', async (req, res) => {
  try {
    const rows = await fetchDataFromCSV();
    
    res.json({
      success: true,
      data: {
        method: 'CSV Export with Dynamic Processing',
        totalRows: rows.length,
        headerRow: rows[0] || [],
        firstEmployeeRow: rows[1] || [],
        sampleDataRows: rows.slice(1, 6),
        extractedQuestions: QUESTIONS,
        extractedCorrectAnswers: CORRECT_ANSWERS,
        allRows: rows
      }
    });

  } catch (error) {
    console.error('❌ Error fetching raw data:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch raw data',
      message: error.message
    });
  }
});

// Install node-fetch if not present
async function ensureNodeFetch() {
  try {
    await import('node-fetch');
    console.log('✅ node-fetch is available');
  } catch (error) {
    console.log('❌ node-fetch not found. Installing...');
    console.log('Please run: npm install node-fetch');
    process.exit(1);
  }
}

// Error handling
app.use((err, req, res, next) => {
  console.error('❌ Unhandled error:', err);
  res.status(500).json({
    success: false,
    error: 'Internal server error',
    message: err.message
  });
});

// Start server
app.listen(PORT, async () => {
  await ensureNodeFetch();
  
  console.log(`🚀 Krishna Maruti Backend Server running on port ${PORT}`);
  console.log(`🌐 Using Dynamic CSV Export method`);
  console.log(`📊 Sheet ID: ${SHEET_ID}`);
  console.log('\n🎯 Dynamic Processing:');
  console.log('   • Questions extracted from header row (columns 6-15)');
  console.log('   • Correct answers taken from first employee (row 2)');
  console.log('   • First employee automatically scores 100%');
  console.log('   • Other employees compared against first employee');
  console.log('\n📋 Available endpoints:');
  console.log(`  - GET http://localhost:${PORT}/api/health`);
  console.log(`  - GET http://localhost:${PORT}/api/test-connection`);
  console.log(`  - GET http://localhost:${PORT}/api/dashboard-stats`);
  console.log(`  - GET http://localhost:${PORT}/api/test-responses`);
  console.log(`  - GET http://localhost:${PORT}/api/questions`);
  console.log(`  - GET http://localhost:${PORT}/api/response/:employeeId`);
  console.log('\n🧪 Test: curl http://localhost:3000/api/test-connection');
});

module.exports = app;