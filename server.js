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
  user: {
    type: mongoose.Schema.Types.ObjectId, // Maks hade [] runt {} för att skapa array av users
    ref: 'User'
  }
})

  //List model
  // const List = mongoose.model('List', {
  //   List: {
  //     type: Array,
  //     task: [{
  //       type: mongoose.Schema.Types.ObjectId,
  //       ref: 'Task',
  //     }],
  //   },
  //   user: {
  //     type: mongoose.Schema.Types.ObjectId,
  //     ref: 'User'
  //   }
  // })
    
// USER model
const User = mongoose.model('User', {
  username:{
    type: String,
    required: [true, 'Username is required'],
    unique: [true, 'Username is already taken'],
    lowercase: true,
    trim: true
  },
  password: {
     type: String,
     required: [true, 'Password is required'],
     minLength: 8,
  },
  accessToken: {
    type: String,
    default: () => crypto.randomBytes(128).toString('hex')
  },
})

// Authentication middleware here
const authenticateUser = async (req, res, next) => {
  const accessToken = req.header('Authorization')

  try {
    const user = await User.findOne({ accessToken })

    if (user) {
      req.user = user // La till detta
      next()
    } else {
      res.status(401).json({ success: false, message: 'Not authenticated' })
    }
  } catch (error) {
    res.status(400).json({ success: false, message: 'Invalid request', error})
  }
}

const port = process.env.PORT || 8084
const app = express()

app.use(cors())
app.use(express.json())

app.get('/', (req, res) => {
  res.send(listEndpoints(app))
})

// Endpoints for list?
// app.get('/list', async (req, res) => {
//   const newList = await List.find().populate('task', 'taskItem').populate('user', 'username')
//   res.json({ success: true, newList})
// })

// GET endpoint to display all tasks (bara visa tasks med userid - findById?)
app.get('/tasks', authenticateUser)
app.get('/tasks', async (req, res) => {
  const allTasks = await Task.find().populate('user', 'username')
  res.json({ success: true, allTasks })
})

// POST endpoint for creating new task
app.post('/tasks', authenticateUser)
app.post('/tasks', async (req, res) => {
  const { taskItem, username } = req.body
  try {
    const user = await User.findOne({ username })
    const newTask = await new Task({ 
      taskItem,
      user // här hade maks [] för en array av users
     }).save()
    res.json({ success: true, newTask})
  } catch (error) {
    res.status(400).json({ message: 'Invalid request', error })
  }
})

// POST endpoint for register as a new user
// expects username, email and password in the body from the POST req in FE
app.post('/register', async (req, res) => {
  const { username, password } = req.body
  //console.log(username, password)
  try {
    const salt = bcrypt.genSaltSync()
    const newUser = await new User({
      username: username,
      password: bcrypt.hashSync(password, salt)
    }).save()
    //console.log(newUser)
    res.json({
      success: true,
      userId: newUser._id,
      username: newUser.username,
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

//endpoint to update tasks
app.patch("/tasks/:id", async (req, res) => {
  const { id } = req.params;
  try {
    const updatedTask= await Task.findByIdAndUpdate(id, req.body, { new: true, });
    if (updatedTask) {
      res.json(updatedTask);
    } else {
      res.status(404).json({ message: "Not found" });
    }
  } catch (error) {
    res.status(400).json({ message: "Invalied requeset", error });
  }
});

app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`)
})
