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

  //Todo list model
  const TodoList = mongoose.model('TodoList', {
    listTitle: { 
        type: String,
        required: [true, 'Task cannot be empty'],
        maxlength: 50,
        trim: true
      },
      user: {
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'User'
      },
      collaborators: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      }],
      tasks: [{
        taskTitle: {
          type: String,
          required: [true, 'Task cannot be empty'],
          trim: true
        },
        complete:{
          type: Boolean,
        }
      }]
  })
    
// User model
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
     minlength: 8
  },
  accessToken: {
    type: String,
    default: () => crypto.randomBytes(128).toString('hex')
  },
})

// Authentication middleware
const authenticateUser = async (req, res, next) => {
  const accessToken = req.header('Authorization')

  try {
    const user = await User.findOne({ accessToken })

    if (user) {
      req.user = user 
      next()
    } else {
      res.status(401).json({ success: false, message: 'Not authenticated' })
    }
  } catch (error) {
    res.status(400).json({ success: false, message: 'Invalid request', error})
  }
}

const port = process.env.PORT || 8087
const app = express()

app.use(cors())
app.use(express.json())

app.get('/', (req, res) => {
  res.send(listEndpoints(app))
})

// GET request - all todo lists
app.get('/lists', authenticateUser)
app.get('/lists', async (req, res) => {
  const { _id } = req.user
  const allLists = await TodoList.find({ collaborators: mongoose.Types.ObjectId(_id) })
    if (allLists) {
      res.json({ success: true, allLists })
    } else {
      res.status(400).json({ success: false, message: 'Invalid request'})
    }
})

// GET request - all tasks
app.get('/tasks/:id', authenticateUser)
app.get ('/tasks/:id', async (req, res) => {
  const { id } = req.params
    try {
      const allTasks = await TodoList.findById({  _id: id })
      res.json({ success: true, tasks: allTasks.tasks})
    } catch (error) {
      res.status(400).json({ success: false, message: 'Invalid request', error })
    }
})

// POST request - create new todo list
app.post('/lists', authenticateUser)
app.post('/lists', async (req, res) => {
  const { listTitle } = req.body
  try {
    const { _id } = req.user
    const newList = await new TodoList({
      collaborators:[_id], 
      listTitle,
     }).save()
    res.json({ success: true, newList})
  } catch (error) {
    res.status(400).json({ success: false, message: 'Invalid request', error })
  }
})

// POST request - register new user
app.post('/register', async (req, res) => {
  const { username, password } = req.body
  try {
    const salt = bcrypt.genSaltSync()
    const newUser = await new User({
      username: username,
      password: bcrypt.hashSync(password, salt)
    }).save()
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

// POST request - sign in
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

// PATCH request - update todo list with new task
app.patch('/tasks', authenticateUser)
app.patch('/tasks', async (req, res) => {
  const { data, listId } = req.body
  try {
    const newTask = await TodoList.findOneAndUpdate({ _id: listId }, { $push: { tasks: data } }, { new: true })
    res.json({ success: true, newTask})
  } catch (error) {
    res.status(400).json({ success: false, message: 'Invalid request', error })
  }
})

//PATCH request - update todo list to remove task
app.patch('/tasks/delete', authenticateUser)
app.patch('/tasks/delete', async (req, res) => {
  const { listId, taskId } = req.body
  try {
    const removeTask = await TodoList.findOneAndUpdate({ _id: listId }, { $pull: { tasks: { _id: taskId} } }, { new: true })
    res.json({ success: true, removeTask})
  } catch (error) {
    res.status(400).json({ success: false, message: 'Invalid request', error })
  }
})

//  update complete (checkbox) (set - replaces the value of a filed with a specified value)
app.patch('/tasks/update', authenticateUser)
app.patch('/tasks/update', async (req, res) => {
  const { listId, complete, taskId } = req.body
  try {
    const updateTask = await TodoList.updateOne({ _id: listId, 'tasks._id': taskId }, { $set: { 'tasks.$.complete': complete }})
    res.json({ success: true, updateTask})
  } catch (error) {
    res.status(400).json({ success: false, message: 'Invalid request', error })
  }
})

//  update listTitle
app.patch('/lists/update', authenticateUser)
app.patch('/lists/update', async (req, res) => {
  const { listId, listTitle } = req.body
  try {
    const updateList = await TodoList.findByIdAndUpdate({ _id: listId }, { $set: { 'listTitle': listTitle }}, { new: true })
    res.json({ success: true, updateList})
  } catch (error) {
    res.status(400).json({ success: false, message: 'Invalid request', error })
  }
})

// DELETE request - delete list
app.delete("/lists/:id", authenticateUser)
app.delete("/lists/:id", async (req, res) => {
  const { id } = req.params;
  try {
    const deletedList = await TodoList.findByIdAndRemove({'_id': id});
    console.log('DET', deletedList);
    if (deletedList) {
      res.json({success: true, deletedList});
    } else {
      res.status(404).json({ success: false, message: "Not found" });
    }
  } catch (error) {
    res.status(400).json({ success: false, message: "Invalid request", error });
  }
})

app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`)
})