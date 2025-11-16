const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const pdfParse = require('pdf-parse');
const cors = require('cors');
const axios = require('axios');
require('dotenv').config();
const { GoogleGenerativeAI } = require('@google/generative-ai');

const app = express();
const port = 5001;

// Initialize GoogleGenerativeAI with API Key
const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);

app.use(express.json());
app.use(cors());

// Multer setup for file uploads
const fileFilter = (req, file, cb) => {
  if (file.mimetype === 'application/pdf') {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only PDFs are allowed.'), false);
  }
};

const upload = multer({ 
  dest: path.join(__dirname, 'uploads'),
  fileFilter
});

let generatedQuestions = [];

// Route to handle file upload and processing
app.post('/upload', upload.single('file'), async (req, res) => {
  if (!req.file) {
    console.error('No file uploaded');
    return res.status(400).json({ message: 'No file uploaded' });
  }

  const filePath = path.join(__dirname, 'uploads', req.file.filename);
  console.log('File uploaded:', req.file.filename);

  try {
    const response = await axios.post(`http://localhost:${port}/process`, { filePath });
    res.json(response.data);
  } catch (error) {
    console.error('Error processing file:', error.message);
    res.status(500).json({ message: 'Error processing file' });
  }
});

// Route to handle file processing (PDF parsing)
app.post('/process', async (req, res) => {
  const { filePath } = req.body;
  console.log('Processing file:', filePath);

  if (!fs.existsSync(filePath)) {
    console.error('File not found:', filePath);
    return res.status(400).json({ message: 'File not found' });
  }

  try {
    const dataBuffer = fs.readFileSync(filePath);
    const parsedData = await pdfParse(dataBuffer);
    const extractedData = parsedData.text;

    const questions = await generateQuestions(extractedData);
    if (!questions || !questions.data || questions.data.length === 0) {
      console.error('No questions generated');
      return res.status(500).json({ message: 'No questions generated' });
    }

    generatedQuestions = questions.data;

    await saveQuestionsToFile(generatedQuestions); // Save to JSON

    // Delete file after processing
    fs.unlink(filePath, (unlinkErr) => {
      if (unlinkErr) {
        console.error('Error deleting file:', unlinkErr);
      } else {
        console.log(`File deleted: ${filePath}`);
      }
    });

    res.json({
      message: 'File processed and questions generated successfully',
      questions: generatedQuestions,
    });

  } catch (error) {
    console.error('Error processing PDF:', error.message);
    res.status(500).json({ message: 'Error processing PDF file' });
  }
});

// Function to generate questions using the Gemini API
const generateQuestions = async (context) => {
  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

    const result = await model.generateContent([
      {
        text: `Generate 10 multiple-choice questions with one correct answer for the following content. Provide the output in JSON array format like this:
[
  {
    "question": "Sample Question?",
    "options": ["Option 1", "Option 2", "Option 3", "Option 4"],
    "correct_answer": "Correct Answer"
  }
]
Content:
${context}`,
      }
    ]);

    console.log('Raw API Result:', result);

    const response = result.response;
    const generatedText = typeof response.text === 'function' 
      ? response.text() 
      : response.text;

    console.log('Generated Text:', generatedText);

    const cleanedText = generatedText
      .replace(/```json|```/g, '')
      .replace(/[\u0000-\u001F\u007F-\u009F]/g, '')
      .replace(/\n/g, '')  // Remove line breaks
      .trim();

    console.log('Cleaned Text:', cleanedText);

    let parsedResponse;
    try {
      parsedResponse = JSON.parse(cleanedText);
    } catch (error) {
      console.error('Error parsing JSON:', error.message);
      throw new Error('Failed to parse JSON');
    }

    let questions = Array.isArray(parsedResponse)
      ? parsedResponse
      : parsedResponse.questions;

    if (!Array.isArray(questions) || questions.length === 0) {
      console.log('No questions generated');
      return { message: 'No questions generated', data: [] };
    }

    //Ensure questions are valid
    questions = questions
      .filter(q => q.question && q.options?.length === 4 && (q.correct_answer || q.answer))
      .map((q) => ({
        question: q.question,
        options: q.options,
        correct_answer: q.correct_answer || q.answer,
      }))
      .slice(0, 10);

    console.log('Formatted Questions:', questions);

    return {
      message: 'Questions generated successfully',
      data: questions,
    };
  } catch (error) {
    console.error('Error generating questions:', error.message);
    throw new Error('Failed to generate questions');
  }
};





// Function to save questions to a JSON file
const saveQuestionsToFile = (questions) => {
  return new Promise((resolve, reject) => {
    const filePath = path.join(__dirname, 'questions.json');
    if (!Array.isArray(questions) || questions.length === 0) {
      return reject(new Error('Invalid or empty questions data'));
    }
    fs.writeFile(filePath, JSON.stringify(questions, null, 2), (err) => {
      if (err) {
        console.error('Error saving questions to file:', err.message);
        return reject(err);
      }
      console.log('Questions saved to file');
      resolve();
    });
  });
};

// Route to handle fetching questions
app.get('/questions', (req, res) => {
  if (!generatedQuestions || generatedQuestions.length === 0) {
    return res.status(400).json({ message: 'No questions available' });
  }
  res.json({ message: 'File processed and questions generated successfully', questions: generatedQuestions });
});

// Route to handle quiz submission and score calculation
app.post('/submit', (req, res) => {
  const { answers } = req.body;

  if (!answers || typeof answers !== 'object') {
    return res.status(400).json({ message: 'Invalid answers format' });
  }

  let score = 0;
  generatedQuestions.forEach((q, index) => {
    const userAnswer = (answers[index] || '').trim().toLowerCase();
    const correctAnswer = (q.correct_answer || '').trim().toLowerCase();

    if (userAnswer === 'skipped question') {
      console.log(`Question ${index + 1} was skipped.`);
    } else if (userAnswer === correctAnswer) {
      score++;
    }
  });

  res.json({ score });
});


app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
