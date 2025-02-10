
import React, { useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import '../styles/HomePage.css';
import fileUploadBackground from '../assets/images/fileuploadbg.jpg';
import quizinfoBackground from '../assets/images/infoimage.jpg'
import backgroundVideo from '../assets/videos/quizbgvideo.mp4';


function HomePage() {
  const navigate = useNavigate();
  const [file, setFile] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [questionCount, setQuestionCount] = useState(0);

  const handleFileChange = (e) => {
    setFile(e.target.files[0]);
  };

  const handleFileUpload = async () => {
    if (!file) {
      alert('Please select a PDF file to upload.');
      return;
    }
    setIsLoading(true);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await axios.post('http://localhost:5001/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });
      
      console.log('Upload Response:', response.data);
      
      if (response.data.message === 'File processed and questions generated successfully') {
        setQuestionCount(response.data.numQuestions);
        setShowConfirmation(true);
      } else {
        alert('Failed to upload file and generate questions.');
      }
    } catch (error) {
      console.error('Error uploading file:', error);
      alert('An error occurred during file upload.');
    } finally {
      setIsLoading(false);
    }
  };
  const startQuiz = () => {
    navigate('/quiz');
  };

  return (
    <div className="home-container">

      <div className="navbar">
        <a href="/">Home</a>
        <a href="/login">Login</a>
        <a href="/info">Info</a>
      </div>

      <div className="video-container">
        <video className="background-video" autoPlay muted loop>
          <source src={backgroundVideo} type="video/mp4" />
          Your browser does not support the video tag.
        </video>

        <div className="video-content">
          <h1 className="title"> Welcome to QuizWeb</h1>
          <p className="description">The ultimate quiz experience!</p>
        </div>
      </div>

      <div
        className="info-section"
        style={{
          backgroundImage: `url(${quizinfoBackground})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      >
        <h2>About QuizWeb</h2>
        <p>
          QuizWeb is an innovative platform designed for quiz enthusiasts and educators alike. 
          Whether you're a student preparing for exams, a teacher looking to create interactive learning tools, or simply a trivia lover, QuizWeb is the perfect place for you.
          On QuizWeb, users can easily create quizzes on any topic, from science to entertainment, and share them with friends or the global community. 
          Our intuitive quiz creation tool allows you to upload questions, choose formats,
          and add multimedia for a dynamic quiz-taking experience.
        </p>
      </div>

      <div className="file-upload-section" style={{ backgroundImage: `url(${fileUploadBackground})` }}>
        <h2>Upload your PDF</h2>
        <input type="file" accept=".pdf" onChange={handleFileChange} />
        <button onClick={handleFileUpload} disabled={isLoading}>
          {isLoading ? (
            <>
              <div className="spinner"></div> Uploading...
            </>
          ) : 'Upload'}
        </button>
      </div>

      {/* Add confirmation dialog */}
      {showConfirmation && (
        <div className="confirmation-overlay">
          <div className="confirmation-dialog">
            <h3>Quiz Ready!</h3>
            <p>{questionCount} questions have been generated from your PDF.</p>
            <p>Would you like to start the quiz now?</p>
            <div className="confirmation-buttons">
              <button onClick={startQuiz} className="start-quiz-btn">Start Quiz</button>
              <button onClick={() => setShowConfirmation(false)} className="cancel-btn">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      <footer className="footer">
        <div className="footer-content">
          <p>&copy; 2024 QuizWeb. All rights reserved.</p>
          <ul className="footer-links">
            <li><a href="#">Privacy Policy</a></li>
            <li><a href="#">Terms of Service</a></li>
            <li><a href="#">Contact Us</a></li>
          </ul>
        </div>
      </footer>
    </div>
  );
}

export default HomePage;
