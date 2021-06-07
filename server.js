import express from 'express'
import cors from 'cors'
import mongoose from 'mongoose'
import crypto from 'crypto'
import bcrypt from 'bcrypt'
import dotenv from 'dotenv'
import listEndpoints from 'express-list-endpoints'

dotenv.config()

const mongoUrl = process.env.MONGO_URL || "mongodb://localhost/finalProject"
mongoose.connect(mongoUrl, { useNewUrlParser: true, useUnifiedTopology: true, useCreateIndex: true })
mongoose.Promise = Promise

// TASK model
const Task = mongoose.model('Task', {
  taskItem: {
    type: String,
    required: [true, 'Task cannot be empty'],
    trim: true
  },
  // isComplete:{
  //   type:Boolean,
  //   default: false
  // },
  // deadline: {
  //   type: Date //Lägg till default: Date.now?? för sortering? react date picker
  // }
})

// USER model
const User = mongoose.model('User', {
  username:{
    type: String,
    required: [true, 'Username is required'],
    unique: [true, 'Username is already taken'],
    lowercase: true,
    trim: true
  },
  email:  {
    type: String,
    required: [true, 'Email is required'],
    unique: [true, 'Email is already in use'],
    lowercase: true,
    trim: true,
    validate: {
      validator: (value) => {
        return /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/.test(value)
      },
      message: 'Enter a valid email address'
    }
  },
  password: {
    type: String,
    required: [true, 'Password is required'],
    minLength: 8,
  },
  accessToken: {
    type: String,
    default: () => crypto.randomBytes(128).toString('hex')
  }
})

// Authentication middleware here

const port = process.env.PORT || 8082
const app = express()

app.use(cors())
app.use(express.json())

app.get('/', (req, res) => {
  res.send(listEndpoints(app))
})

// GET endpoint to display all tasks
app.get('/tasks', async (req, res) => {
  const allTasks = await Task.find()
  res.json({ success: true, allTasks })
})

// POST endpoint for creating new task
app.post('/tasks', async (req, res) => {
  const { taskItem } = req.body
  // const { deadline } = req.body
  try {
    const newTask = await new Task({ taskItem }).save()
    res.json(newTask)
  } catch (error) {
    res.status(400).json({ message: 'Invalid request', error })
  }
})

// POST endpoint for register as a new user
// expects username, email and password in the body from the POST req in FE
// Authentication here
app.post('/register', async (req, res) => {
  const { username, email, password } = req.body

  try {
    const salt = bcrypt.genSaltSync()
    const newUser = await new User({
      username,
      email,
      password: bcrypt.hashSync(password, salt)
    }).save()
    res.json({
      success: true,
      userId: newUser._id,
      username: newUser.username,
      email: newUser.email,
      accessToken: newUser.accessToken 
    })
  } catch (error) {
    res.status(400).json({ success: false, message: 'Invalid request', error})
  }
})

// POST endpoint to signin created user
app.post('/signin', async (req, res) => {
  const { username, password } = req.body

  try {
    const user = await User.findOne({ username })
    
    if (user && bcrypt.compareSync(password, user.password)) {
      res.json({
        success: true,
        userID: user._id,
        username: user.username,
        accessToken: user.accessToken
      })
    } else {
      res.status(404).json({ success: false, message: 'User not found' })
    }
  } catch (error) {
    res.status(400).json({ success: false, message: 'Invalid request', error })
  }
})

app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`)
})
