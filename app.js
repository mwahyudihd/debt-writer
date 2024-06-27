//modules
const bcrypt = require('bcrypt')
const express = require('express')
const User = require('./models/user')
const Debt = require('./models/debt')
const mongoose = require('mongoose')
const cookieParser = require('cookie-parser')
const flash = require('connect-flash')
const session = require('express-session')
const expressLayouts = require('express-ejs-layouts')
const { body, validationResult, check, Result } = require('express-validator')
const methodOverride = require('method-override')

//server init
const port = 3000
const app = express()

//db config
mongoose.connect('mongodb://127.0.0.1:27017/db_debtwriter')
    .then((result) => {
        console.log('connected to mongodb')
    }).catch((err) => {
        console.log(err)
    })

//setup ejs
app.set('view engine', 'ejs')
app.use(expressLayouts)
app.use(express.static('public'))

//configure

app.use(session({
    secret: 'notasecreet',
    resave: false,
    saveUninitialized: false
}))
app.set('view engine', 'ejs')
app.set('views', 'views')

app.use(express.urlencoded({
    extended: true
}))

app.use(methodOverride('_method'))

//func middleware authentication
const auth = (req, res, next) => {
    if (!req.session.user_id) {
        return res.redirect('/login')
    } else next()
}

const notAuth = (req, res, next) => {
    if (!req.session.user_id) {
        next()
    } else return res.redirect('/profile')
}

//flash data for message
app.use(cookieParser('secret'))
app.use(flash())

//index
app.get('/', (req, res) => {
    res.render('index', {
        cekSesi: req.session.user_id,
        title: 'Home Page',
        layout: './layouts/main-layout'
    })
})

//form debt
app.get('/notes/add', auth, (req, res) => {
    res.render('add-note', {
        cekSesi: req.session.user_id,
        title: 'Form debt',
        layout: 'layouts/main-layout'
    })
})

//detail
app.get('/notes/:_id', auth, async (req, res) => {
    try {
        const debt = await Debt.findOne({ _id: req.params._id })
        const tgl_hutang = debt.tgl_hutang
        const deadlined = debt.deadline
        let formattedDate = tgl_hutang.toLocaleDateString('id-ID', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' })
        let formattedDeadline = deadlined.toLocaleDateString('id-ID', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' });
        res.render('detail', {
            cekSesi: req.session.user_id,
            formattedDeadline,
            formattedDate,
            debt,
            title: 'Debt Detail',
            layout: './layouts/main-layout'
        })
    } catch (e) {
        res.redirect('/404')
    }
})

app.delete('/notes', async (req, res) => {
    const namaPemberi = await Debt.findOne({ _id: req.body._id })
    Debt.deleteOne({ _id: req.body._id }).then((result) => {
        req.flash('msg', `Data Hutang dengan nama pemberi hutang ${namaPemberi.pemberi} Berhasil dihapus`)
        res.redirect('/notes')
    })
})

//profile
app.get('/profile', auth, async (req, res) => {
    const cekSesi = req.session.user_id
    const userProfile = await User.findOne({ _id: cekSesi })
    res.render('profile', {
        userProfile,
        cekSesi,
        title: 'Profile',
        layout: './layouts/main-layout'
    })
})

app.post('/register', body('username').custom(async (value) => {
    const duplicateData = await User.findOne({ username: value })
    if (duplicateData) {
        throw new Error('Username sudah digunakan!')
    }
    return true;
}), async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        res.render('register', {
            layout: 'register',
            errors: errors.array()
        })
    } else {
        const { username, password, nama, role } = req.body
        const user = new User({ username, password, nama, role })
        await user.save()
        req.session.user_id = user._id
        res.redirect('/')
    }

})

//adding data process
app.post('/notes', async (req, res) => {
    const { pencatat, pemberi, jumlah, tgl_hutang, deadline, catatan, status } = req.body
    const debt = new Debt({ pencatat, pemberi, jumlah, tgl_hutang, deadline, catatan, status })
    await debt.save()
    req.flash('msg', 'Data Hutang Berhasil ditambahkan!')
    res.redirect('/notes')
})

app.get('/register', notAuth, (req, res) => {
    res.render('register', {
        title: 'Register - Page',
        cekSesi: req.session.user_id,
        layout: './layouts/main-layout'
    })
})

app.get('/login', notAuth, (req, res) => {
    res.render('login', {
        title: 'Login - Page',
        cekSesi: req.session.user_id,
        layout: './layouts/main-layout'
    })
})

app.post('/login', async (req, res) => {
    const { username, password } = req.body
    const user = await User.findByCredentials(username, password)
    if (user) {
        req.session.user_id = user._id
        req.session.name_user = user.nama
        res.redirect('/')
    } else {
        res.redirect('/login')
    }
})

//debt data
app.get('/notes', auth, async (req, res) => {
    const cekSesi = req.session.user_id
    const debt = await Debt.find({ pencatat: cekSesi })
    res.render('debt-data', {
        cekSesi,
        debt,
        msg: req.flash('msg'),
        title: 'Notes - Debt',
        layout: './layouts/main-layout'
    })
})

app.get('/notes/status/:_id', auth, async (req, res) => {
    try {
        const debt = await Debt.findOne({ _id: req.params._id })
        const dateNow = new Date()
        let day = dateNow.getDate();
        let month = dateNow.getMonth() + 1
        let year = dateNow.getFullYear()
        if (day < 10) day = '0' + day
        if (month < 10) month = '0' + month
        let dateFormat = year + '-' + month + '-' + day;
        res.render('status', {
            cekSesi: req.session.user_id,
            dateFormat,
            debt,
            title: 'Update Status',
            layout: './layouts/main-layout'
        })
    } catch (error) {
        res.redirect('/404')
    }
})

app.put('/notes', (req, res) => {
    Debt.updateOne(
        {
            _id: req.body._id
        },
        {
            $set: {
                lunas_pada: req.body.lunas_pada,
                status: req.body.status
            }
        }
    ).then((result) => {
        //pesan singkat /flash message
        req.flash('msg', `Status hutang ${req.body.pemberi} Berhasil diubah!`)

        res.redirect('/notes')
    })


})

app.post('/logout', auth, (req, res) => {
    req.session.user_id = null
    res.redirect('/login')
})


app.use((req, res) => {
    res.status(404)
    res.render(
        '404',
        {
            cekSesi: req.session.user_id,
            title: '404 Not Found',
            layout: './layouts/main-layout'
        }
    )
})

app.listen(port, () => {
    console.log(`Server is running on localhost:${port}`)
})