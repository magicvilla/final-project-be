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

  //List model
  const List = mongoose.model('List', {
    listName: {
        type: String,
        required: [true, 'Task cannot be empty'],
        maxlength: 20,
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
      tasks: [{ // can this be done in a nicer way
        taskItem: {
          type: String,
          required: [true, 'Task cannot be empty'],
          trim: true
        },
        complete:{
          type: Boolean, // check if list is complete
        }
      }]
  })

//Task model
const Task = mongoose.model('Task', {
  taskItem: {
    type: String,
    required: [true, 'Task cannot be empty'],
    trim: true
  },
  complete:{
    type: Boolean, // check if task is checked
  }
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
      req.user = user 
      next()
    } else {
      res.status(401).json({ success: false, message: 'Not authenticated' })
    }
  } catch (error) {
    res.status(400).json({ success: false, message: 'Invalid request', error})
  }
}

const port = process.env.PORT || 8086
const app = express()

app.use(cors())
app.use(express.json())

app.get('/', (req, res) => {
  res.send(listEndpoints(app))
})

// GET request - all lists
app.get('/lists', authenticateUser)
app.get('/lists', async (req, res) => {
  const { _id } = req.user
  const allLists = await List.find({ collaborators: mongoose.Types.ObjectId(_id) })
    if (allLists) {
      res.json({ success: true, allLists })
    } else {
      res.status(400).json({ message: 'Invalid request'})
    }
})

// POST request - create new list
app.post('/lists', authenticateUser)
app.post('/lists', async (req, res) => {
  const { listName } = req.body
  try {
    const { _id } = req.user
    const newList = await new List({
      collaborators:[_id], 
      listName,
     }).save()
    res.json({ success: true, newList})
  } catch (error) {
    res.status(400).json({ message: 'Invalid request', error })
  }
})

// GET request - all tasks
app.get('/tasks/:id', authenticateUser)
app.get ('/tasks/:id', async (req, res) => {
  const { id } = req.params
    try {
      const allTasks = await List.findById({  _id: id })
      res.json({ success: true, tasks: allTasks.tasks})
    } catch (error) {
      res.status(400).json({ message: 'Invalid request', error })
    }
})

// PATCH request - creating new task in a list that already exists
app.patch('/tasks', authenticateUser)
app.patch('/tasks', async (req, res) => {
  const { data, listId } = req.body
  try {
    const newTask = await List.findOneAndUpdate({ _id: listId }, { $push: { tasks: data } }, { new: true })
    res.json({ success: true, newTask})
  } catch (error) {
    res.status(400).json({ message: 'Invalid request', error })
  }
})

// DELETE request - delete list
app.delete("/lists/:id", authenticateUser)
app.delete("/lists/:id", async (req, res) => {
  const { id } = req.params;
  try {
    const deletedList = await List.findOneAndDelete({ _id: id });
    if (deletedList) {
      res.json(deletedList);
    } else {
      res.status(404).json({ message: "Not found" });
    }
  } catch (error) {
    res.status(400).json({ message: "Invalid request", error });
  }
});

// POST request - register new user
app.post('/register', async (req, res) => {
  const { username, password } = req.body
  //console.log(username, password)
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

app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`)
})

//PATCH request - update tasks
// app.patch("/tasks/:id", async (req, res) => {
//   const { id } = req.params;
//   try {
//     const updatedTask= await Task.findByIdAndUpdate(id, req.body, { new: true, });
//     if (updatedTask) {
//       res.json(updatedTask);
//     } else {
//       res.status(404).json({ message: "Not found" });
//     }
//   } catch (error) {
//     res.status(400).json({ message: "Invalied requeset", error });
//   }
// });

//Patch request heckbox
// app.patch("/toggleTaskCompletion/:id", async (req, res) => {
//   const { id } = req.params;
//   try {
//     const checkedTask= await Task.findByIdAndUpdate(id, req.body, { new: true, });
//     if (updatedTask) {
//       res.json(checkedTask);
//     } else {
//       res.status(404).json({ message: "Not found" });
//     }
//   } catch (error) {
//     res.status(400).json({ message: "Invalied requeset", error });
//   }
// });