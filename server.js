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

const Task = mongoose.model('Task', {
  taskItem: {
    type: String,
    required: [true, 'No empty task!'],
    trim: true
  },
  deadline: {
    type: Date //Lägg till default: Date.now?? för sortering? react date picker
  }
})

const port = process.env.PORT || 8081
const app = express()

app.use(cors())
app.use(express.json())

app.get('/', (req, res) => {
  res.send(listEndpoints(app))
})

// GET Display tasks
app.get('/tasks', async (req, res) => {
  const allTasks = await Task.find()
  res.json(allTasks)
})

// POST endpoint for creating new task
app.post('/tasks', async (req, res) => {
  try {
    const newTask = await new Task({ taskItem: req.body.taskItem, deadline: req.body.deadline }).save()
    res.json(newTask)
  } catch (error) {
    res.status(400).json({ message: 'Invalid request', error })
  }
})

app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`)
})
