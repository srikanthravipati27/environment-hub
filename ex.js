const express = require('express');
const app = express();
const bodyParser = require('body-parser');
const session = require('express-session');
const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcrypt');
const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

const serviceAccount = require('./abc.json');

initializeApp({
    credential: cert(serviceAccount)
});

const db = getFirestore();
const PORT = process.env.PORT || 3000;

app.set('view engine', 'ejs');
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(__dirname + '/public'));
app.use(session({
    secret: uuidv4(),
    resave: false,
    saveUninitialized: true
}));


function isAuthenticated(req, res, next) {
    if (req.session.user) {
        next();
    } else {
        res.redirect('/signin');
    }
}


app.get('/', (req, res) => {
    res.render('index', { title: 'Environmental Education Hub' });
});


app.get('/signup', (req, res) => {
    res.render('signup', { registered: null, useregistered: null });
});

app.post('/signup', async (req, res) => {
    const { firstname, Username, email, password } = req.body;
    const first_name = firstname.trim();
    const user_name = Username.trim();
    const email_trimmed = email.trim();
    const password_trimmed = password.trim();

    try {
        const emailSnapshot = await db.collection('users')
            .where('email', '==', email_trimmed)
            .get();
        
        if (!emailSnapshot.empty) {
            return res.render('signup', { registered: 'already registered', useregistered: null });
        }

        const userNameSnapshot = await db.collection('users')
            .where('userName', '==', user_name)
            .get();

        if (!userNameSnapshot.empty) {
            return res.render('signup', { registered: null, useregistered: 'username exists' });
        }

        const hashedPassword = await bcrypt.hash(password_trimmed, 10);

        await db.collection('users').add({
            name: first_name,
            userName: user_name,
            email: email_trimmed,
            password: hashedPassword
        });

        res.render('signin');
    } catch (error) {
        console.error("Error creating user: ", error);
        res.status(500).send('Internal Server Error');
    }
});


app.get('/signin', (req, res) => {
    res.render('signin');
});

app.post('/signin', async (req, res) => {
    const { email, password } = req.body;

    try {
        const userSnapshot = await db.collection('users')
            .where('email', '==', email)
            .get();

        if (userSnapshot.empty) {
            return res.end('Invalid username or password');
        }

        const user = userSnapshot.docs[0].data();
        const passwordMatch = await bcrypt.compare(password, user.password);

        if (passwordMatch) {
            req.session.user = user.userName;
            res.redirect('/home');
        } else {
            res.end('Invalid username or password');
        }
    } catch (error) {
        console.error("Error logging in: ", error);
        res.status(500).send('Internal Server Error');
    }
});


app.get('/home', isAuthenticated, async (req, res) => {
    try {
        const userSnapshot = await db.collection('users')
            .where('userName', '==', req.session.user)
            .get();

        if (userSnapshot.empty) {
            return res.redirect('/signin');
        }

        const user = userSnapshot.docs[0].data();
        res.render('home', { user: req.session.user, welcomename: user.name });
    } catch (error) {
        console.error("Error fetching user: ", error);
        res.status(500).send('Internal Server Error');
    }
});


app.get('/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            console.error(err);
            res.send(err);
        } else {
            res.render('signin', { logout: 'Logout Successful' });
        }
    });
});


app.get('/profile', isAuthenticated, async (req, res) => {
    try {
        const userSnapshot = await db.collection('users')
            .where('userName', '==', req.session.user)
            .get();

        if (userSnapshot.empty) {
            return res.redirect('/signin');
        }

        const user = userSnapshot.docs[0].data();
        res.render('profile', { user: req.session.user, profile: user });
    } catch (error) {
        console.error("Error fetching profile: ", error);
        res.status(500).send('Internal Server Error');
    }
});


app.get('/about', isAuthenticated, (req, res) => {
    res.render('about');
});


app.get('/contact', isAuthenticated, (req, res) => {
    res.render('contact');
});


app.get('/articles', isAuthenticated, async (req, res) => {
    try {
        const articlesRef = db.collection('articles');
        const snapshot = await articlesRef.get();
        const articles = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        res.render('articles/index', { articles });
    } catch (error) {
        console.error("Error fetching articles: ", error);
        res.status(500).send('Internal Server Error');
    }
});

app.get('/articles/:id', isAuthenticated, async (req, res) => {
    try {
        const articleRef = db.collection('articles').doc(req.params.id);
        const doc = await articleRef.get();
        if (!doc.exists) {
            res.status(404).send('Article not found');
        } else {
            res.render('articles/show', { article: doc.data() });
        }
    } catch (error) {
        console.error("Error fetching article: ", error);
        res.status(500).send('Internal Server Error');
    }
});


app.get('/activities', isAuthenticated, async (req, res) => {
    try {
        const activitiesRef = db.collection('activities');
        const snapshot = await activitiesRef.get();
        const activities = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        res.render('activities/index', { activities });
    } catch (error) {
        console.error("Error fetching activities: ", error);
        res.status(500).send('Internal Server Error');
    }
});

app.get('/activities/:id', isAuthenticated, async (req, res) => {
    try {
        const activityRef = db.collection('activities').doc(req.params.id);
        const doc = await activityRef.get();
        if (!doc.exists) {
            res.status(404).send('Activity not found');
        } else {
            res.render('activities/show', { activity: doc.data() });
        }
    } catch (error) {
        console.error("Error fetching activity: ", error);
        res.status(500).send('Internal Server Error');
    }
});



app.get('/forum', isAuthenticated, async (req, res) => {
    try {
        const forumRef = db.collection('forum');
        const snapshot = await forumRef.get();
        const threads = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        res.render('forum/index', { threads });
    } catch (error) {
        console.error("Error fetching forum: ", error);
        res.status(500).send('Internal Server Error');
    }
});

app.get('/forum/:id', isAuthenticated, async (req, res) => {
    try {
        const threadRef = db.collection('forum').doc(req.params.id);
        const doc = await threadRef.get();
        if (!doc.exists) {
            res.status(404).send('Thread not found');
        } else {
            res.render('forum/show', { thread: doc.data() });
        }
    } catch (error) {
        console.error("Error fetching thread: ", error);
        res.status(500).send('Internal Server Error');
    }
});

app.listen(PORT, () => {
    console.log("Server running on http://localhost:" + PORT);
});
