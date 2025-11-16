# Quiz Web Application

This project is a Quiz Web Application that leverages Generative AI (GenAI) and ReactJS to generate multiple-choice questions from uploaded PDF documents. It includes features for auto-grading and feedback, providing an interactive and user-friendly experience for quiz takers.

## Features

- **PDF Upload:** Upload a PDF document to generate quiz questions.
- **Question Generation:** Automatically generates multiple-choice questions using Google GenAI API.
- **Auto-Grading:** Automatically evaluates quiz answers and provides feedback.
- **Interactive UI:** Developed using ReactJS for a dynamic and responsive user interface.

## Technologies Used

- **Frontend:** ReactJS
- **Backend:** Node.js, Express
- **File Handling:** Multer for file uploads
- **AI Integration:** Google GenAI API for question generation

## Setup and Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/your-repo/quiz-web-app.git
   ```

2. Navigate to the project directory:
   ```bash
   cd quizweb
   ```

3. Install dependencies for both frontend and backend:
   ```bash
   cd frontend
   npm install
   cd ../backend
   npm install
   ```

4. Create a `.env` file in the backend directory and add your Google API key:
   ```env
   GOOGLE_API_KEY=your_google_api_key
   ```

5. Start the backend server:
   ```bash
   cd backend
   node server.js
   ```

6. Start the frontend development server:
   ```bash
   cd frontend
   npm start
   ```

## Usage

1. Open the web application in your browser.
2. Upload a PDF document to generate quiz questions.
3. Answer the generated questions and submit to receive auto-grading and feedback.

## Project Structure

```plaintext
quizweb/
|----frontend/
|       |----src/
|       |       |----components/
|       |               |----HomePage.js
|       |               |----QuizPage.js
|       |----public/
|----backend/
|       |----uploads/
|       |----questions.json
|       |----server.js
```

## Author

Created by **Manav Mangela**

---

Feel free to contribute or raise issues to enhance the project further!

