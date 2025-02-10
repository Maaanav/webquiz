
import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import '../styles/QuizPage.css';
import backgroundVideo from '../assets/videos/quizbg.mp4'; 

function QuizPage() {
  const navigate = useNavigate();
  const [questions, setQuestions] = useState([]);
  const [answers, setAnswers] = useState({});
  const [score, setScore] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [timer, setTimer] = useState(30);
  const [quizCompleted, setQuizCompleted] = useState(false);

  useEffect(() => {
    const fetchQuestions = async () => {
      setIsLoading(true);
      try {
        const response = await axios.get('http://localhost:5001/questions');
        console.log('Fetched Questions Response:', response.data); 

        if (response.data.questions && response.data.questions.length > 0) {
          setQuestions(response.data.questions);
        } else {
          alert('No questions available.');
          navigate('/'); 
        }
      } catch (error) {
        console.error('Error fetching questions:', error);
        alert('Failed to fetch quiz questions.');
        navigate('/'); 
      } finally {
        setIsLoading(false);
      }
    };

    fetchQuestions();
  }, [navigate]);

  const handleAnswerChange = (e, index) => {
    setAnswers({
      ...answers,
      [index]: e.target.value
    });
  };

  const handleSubmit = useCallback(async (e) => {
    if (e) e.preventDefault();
    try {
      const response = await axios.post('http://localhost:5001/submit', { answers });
      console.log('Submit Response:', response.data); 

      if (response.data.score !== undefined) {
        setScore(response.data.score);
        setTimer(0);
        setQuizCompleted(true);
      } else {
        alert('Failed to submit quiz.');
      }
    } catch (error) {
      console.error('Error submitting quiz:', error);
      alert('Failed to submit quiz.');
    }
  }, [answers]);

  const nextQuestion = useCallback((e) => {
    if (e) e.preventDefault();

    if (!answers.hasOwnProperty(currentQuestion)) {
      setAnswers({
        ...answers,
        [currentQuestion]: 'skipped question'
      });
    }

    if (currentQuestion < questions.length - 1) {
      setCurrentQuestion(currentQuestion + 1);
      setTimer(30);
    } else {
      handleSubmit(e);
    }
  }, [currentQuestion, answers, questions.length, handleSubmit]);


  useEffect(() => {
    if (quizCompleted || currentQuestion >= questions.length) return;

    if (timer > 0) {
      const countdown = setTimeout(() => setTimer(timer - 1), 1000);
      return () => clearTimeout(countdown);
    } else {
      nextQuestion();
    }
  }, [timer, currentQuestion, quizCompleted, questions.length, nextQuestion]);

  const handleGoHome = () => {
    navigate('/');
  };

  if (isLoading) {
    return (
      <div className="quiz-container">
        <video className="quiz-background-video" autoPlay muted loop>
          <source src={backgroundVideo} type="video/mp4" />
          Your browser does not support the video tag.
        </video>
        <div className="quiz-overlay"></div>
        <div className="quiz-content">
          <div className="loading">
            <div className="spinner"></div> Loading Questions...
          </div>
        </div>
      </div>
    );
  }

  if (!isLoading && questions.length === 0) {
    return (
      <div className="quiz-container">
        <video className="quiz-background-video" autoPlay muted loop>
          <source src={backgroundVideo} type="video/mp4" />
          Your browser does not support the video tag.
        </video>
        <div className="quiz-overlay"></div>
        <div className="quiz-content">
          <div className="error">No questions available.</div>
        </div>
      </div>
    );
  }

  const currentQ = questions[currentQuestion];

  if (!currentQ) {
    return (
      <div className="quiz-container">
        <video className="quiz-background-video" autoPlay muted loop>
          <source src={backgroundVideo} type="video/mp4" />
          Your browser does not support the video tag.
        </video>
        <div className="quiz-overlay"></div>
        <div className="quiz-content">
          <div className="error">Question not found.</div>
        </div>
      </div>
    );
  }

  return (
    <div className="quiz-container">

      <video className="quiz-background-video" autoPlay muted loop>
        <source src={backgroundVideo} type="video/mp4" />
        Your browser does not support the video tag.
      </video>


      <div className="quiz-overlay"></div>

      <div className="quiz-content">
        {!quizCompleted ? (
          <div className="quiz-form">
            
            <div className="progress-indicator">
              Question {currentQuestion + 1} of {questions.length}
            </div>

            <div className="timer">
              Time Remaining: {timer} sec
            </div>
            <div className="question-block">
              <form onSubmit={handleSubmit}>
                <p className="question-text">{currentQ.question}</p>
                <div className="options-grid">
                  {currentQ.options.map((option, optIndex) => (
                    <div 
                      key={optIndex} 
                      className={`option-button ${answers[currentQuestion] === option ? 'selected' : ''}`}
                    >
                      <input
                        type="radio"
                        id={`option-${currentQuestion}-${optIndex}`}
                        name={`question-${currentQuestion}`}
                        value={option}
                        onChange={(e) => handleAnswerChange(e, currentQuestion)}
                        checked={answers[currentQuestion] === option}
                        required
                      />
                      <label htmlFor={`option-${currentQuestion}-${optIndex}`}>
                        {option}
                      </label>
                    </div>
                  ))}
                </div>

                <div className="navigation-buttons">
                  {currentQuestion < questions.length - 1 ? (
                    <button type="button" onClick={nextQuestion} className="next-button">Next</button>
                  ) : (
                    <button type="button" onClick={handleSubmit} className="submit-button">Submit</button>
                  )}
                </div>
              </form>
            </div>
          </div>
        ) : (
          <div className="result-section">
            <h2 className="score-display">Your Score: {score}/{questions.length}</h2>
            <button onClick={handleGoHome} className="go-home-button">Go to Home</button>
          </div>
        )}
      </div>
    </div>
  );
}

export default QuizPage;
