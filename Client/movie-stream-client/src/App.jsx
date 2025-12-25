import { useState } from 'react'
import './App.css'
import Home from './components/home/Home.jsx'
import Header from './components/header/Header.jsx'
import Login from './components/login/Login.jsx'
import Register from './components/register/Register.jsx'
import {Route, Routes, useNavigate} from 'react-router-dom';

function App() {

  return (
    <>
      <Header />
      <Routes>
        <Route path='/' element={<Home />} />
        <Route path='/recommend' element={<h2>Recommendations Page - Coming Soon!</h2>} />
        <Route path='/login' element={<Login />} />
        <Route path='/register' element={<Register />} />
      </Routes>
    </>
  )
}

export default App
