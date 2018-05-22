var express = require('express');
var session = require('express-session');
var path = require('path');
var bcrypt = require('bcrypt-nodejs');
var cookieParser = require('cookie-parser');
var mongoose = require('mongoose');       
var crypto = require('crypto'); 
var nodemailer = require('nodemailer');
var expressJWT = require('express-jwt');
var validation = require('express-validator')
var jwt = require('jsonwebtoken');
var bodyParser = require('body-parser');
var http = require("http").Server(app);
var io = require("socket.io")(http);


mongoose.connect('mongodb://localhost:27017/db');
var app = express();

app.use(bodyParser.json())
app.use(bodyParser.urlencoded({
  extended:true  // methods to easy
}));
app.use(cookieParser())
app.use(express.static(path.join(__dirname, 'views')));
app.set('views',path.join(__dirname,'views'));
app.set('view engine', 'ejs');

var Schema = mongoose.Schema;

var logSchema = new Schema({     
  name: String,                  //define schema...
  password:String,
  email:
{
    type    : String,
    required : true,
    unique   : true  // ensure unique email
},
  mobileNo : Number,
  salt: String,
  active:{type:String,default: false},
  token:String,
  created: {type:Date,default:Date.now}
});  

var user=mongoose.model('user',logSchema);                // compile our model.....

app.get('/',(req,res)=>{
  res.render(path.join(__dirname,'/views/signup.ejs'));
})

app.get('/login',(req,res)=>{
  res.render(path.join(__dirname,'/views/login.ejs'));     
})  

// usernames which are currently connected in the room
var usernames = {};

var rooms = ['room1','room2','room3'];

io.sockets.on('connection', function (socket) {

	socket.on('adduser', function(username){
    
    socket.username = username;

    socket.room = 'room1';
				usernames[username] = username;
				socket.join('room1');
				socket.emit('updatechat', 'SERVER', 'you have connected to room1');
				socket.broadcast.to('room1').emit('updatechat', 'SERVER', username + ' has connected to this room');
		socket.emit('updaterooms', rooms, 'room1');
 	});

	
	socket.on('sendchat', function (data) {
	
		io.sockets.in(socket.room).emit('updatechat', socket.username, data);
	});

	socket.on('switchRoom', function(newroom){
			socket.leave(socket.room);
			socket.join(newroom);

      socket.emit('updatechat', 'SERVER', 'you have connected to '+ newroom);
				socket.broadcast.to(socket.room).emit('updatechat', 'SERVER', socket.username+' has left this room');
				socket.room = newroom;
  
        socket.broadcast.to(newroom).emit('updatechat', 'SERVER', socket.username+' has joined this room');
		socket.emit('updaterooms', rooms, newroom);
	});

		socket.on('disconnect', function(){
			delete usernames[socket.username];
		io.sockets.emit('updateusers', usernames);
		socket.broadcast.emit('updatechat', 'SERVER', socket.username + ' has disconnected');
		socket.leave(socket.room);
	});
});

app.post ('/signup',function(req,res,next){
  console.log(req.body)
  var s1 =new user ({        // model variable name var signi       //schema defined
    name :req.body.name,
    email:req.body.email,
  password : req.body.password,
   mobileNo  : req.body.mobileNo,
   token     : crypto.randomBytes(16).toString('hex'),
  });
 
  user.findOne ({email:s1.email},(err,user) => {
    console.log("coming")
    if(user)
    {
      res.send('user already exist');
    }
    if(err)
    {
      console.log(err);   
    }   
    if(!user)
    {
      console.log("new user")
      var salt = bcrypt.genSaltSync(10);
      var hash = bcrypt.hashSync(s1.password, salt);
      s1.password = hash;
      s1.save((err,user) => 
      {
       if(err)
        {
           res.send('something went wrong');
        } 
    if(user)
       {
          console.log('token generated bkjhdbasbsk');
          console.log(user);
          var transporter = nodemailer.createTransport({ service: 'Sendgrid', auth: { user:'*******', pass: '**********' } }); // use sendgrid account to send ur mails
          var mailOptions = { from: 'noreply-pradee@auth.com', to: s1.email, subject: 'Account Verification Token', text: 'Hello,\n' + 'Please verify your account by clicking the link: \nhttp://localhost:8040/confirmation' + user.token +'\n' };
          transporter.sendMail(mailOptions, function (err)
          {
            if (err) 
            { 
              return res.send('email problem');
            }
               res.send('A verification email has been sent to ' + s1.email + '.');
               //res.render(path.join(__dirname,'/views/login.ejs'));
          });
        }
      
      })
    }  
  });
});

app.get('/confirmation/:token', (req,res,next)=>{
 let token= req.params.token;
 console.log(token);   
  // Find a matching token 
  user.findOne({ token:token }, function (err, user )
  {
    if (!user.token) return res.status(400).send({ type: 'not-verified', msg: 'We were unable to find a valid token. Your token my have expired.' });
       if (!user.active) return res.status(400).send({ type:   'already-verified', msg: 'This user has already been verified.' });
 // Verify and save the user
        user.active = true;
        user.save(function (err){ 
 
     
            if (err) 
            { 
              return res.render(path.join(__dirname,'/views/error.ejs'));
            }
            else
            {
             console.log('login page running !!!')
           res.render(path.join(__dirname,'/views/login.ejs'));
            } 
       })
    });
    });
    app.post('/login',function (req,res,next) {
      var email = req.body.email;
       var password =req.body.password;
       console.log("check it the user")
      user.findOne({email:email}, function(err,user){
        console.log("allow the user")
              
        if(err) 
        {
          throw err;
        console.log("is it coming to password")
        }
           if(user)
              {
                console.log("it works")
              if (bcrypt.compareSync(password,user.password) && (user.active == true)) 
                {
                            console.log (user);
                            console.log ('tokem generated')
                            // res.render(path.join(__dirname,'/views/dashboard.ejs'))
                            res.sendFile(__dirname + '/public/index.html');
                }
              }   
                else 
                res.render(path.join(__dirname,'/views/error.ejs')) 
            
            
         
  });
});
//   app.get ('/*', function (req,res,next){
//     res.json({
//       message: "invalid routes...."
//     })   
 
//  });
 

app.listen (8040, console.log('Server is running in 8040'));
 
