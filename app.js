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
const currencyFormatter = require('currency-formatter')
const date = require('date-and-time')
const moment = require('moment')
const _ = require('lodash')
require('dotenv').config()

//server init
const port = process.env.PORT || 3000;
const app = express()

//db config
mongoose.connect(process.env.MONGODB_URI)
    .then((result) => {
        console.log('connected to mongodb');
    }).catch((err) => {
        console.log(err);
    });

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
app.get('/', async (req, res) => {
    try {
        const now = new Date();
        const limitDate = new Date(now);
        limitDate.setDate(now.getDate() + 5);

        let debts = [];
        if (req.session.user_id != null) {
            debts = await Debt.find({
                pencatat: req.session.user_id,
                deadline: { $lt: limitDate },
                status: 'unpaid'
            });
        }

        res.render('index', {
            debts,
            cekSesi: req.session.user_id,
            title: 'Home Page',
            layout: './layouts/main-layout',
            currencyFormatter
        });
    } catch (err) {
        console.log(err);
        res.redirect('/404');
    }
});



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
        const interestSet = _.divide(debt.bunga, 100)
        const preDebtTotal = debt.jumlah * interestSet
        let paidDate
        if (debt.lunas_pada != null) {
            paidDate = moment(debt.lunas_pada).locale('id').format('ddd, DD MMM YYYY')
        } else paidDate = null
        res.render('detail', {
            preDebtTotal: currencyFormatter.format(preDebtTotal, { locale: 'id-ID' }),
            debtCount: currencyFormatter.format(debt.jumlah, { locale: 'id-ID' }),
            cekSesi: req.session.user_id,
            paidDate,
            formattedDeadline: moment(debt.deadline).locale('id').format('ddd, DD MMM YYYY'),
            formattedDate: moment(debt.tgl_hutang).locale('id').format('ddd, DD MMM YYYY'),
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
    let { bunga } = req.body

    if (!bunga) {
        bunga = undefined
    }

    const debtData = { pencatat, pemberi, jumlah, tgl_hutang, deadline, catatan, status }

    if (bunga !== undefined) {
        debtData.bunga = bunga
    }

    const debt = new Debt(debtData)

    try {
        await debt.save()
        req.flash('msg', 'Data Hutang Berhasil ditambahkan!')
        res.redirect('/notes')
    } catch (error) {
        console.log(error)
        res.redirect('/404')
    }
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
        const now = new Date();
        const dateFormat = date.format(now, 'YYYY-MM-DD');
        res.render('status', {
            cekSesi: req.session.user_id,
            dateFormat,
            debt,
            title: 'Update Status',
            layout: './layouts/main-layout'
        })
    } catch (error) {
        console.log(error)
        res.redirect('/404')
    }
})

app.get('/notes/edit/:_id', auth, async (req, res) => {
    try {
        const debt = await Debt.findOne({ _id: req.params._id })
        const dateStart = date.format(debt.tgl_hutang, 'YYYY-MM-DD')
        const deadline = date.format(debt.deadline, 'YYYY-MM-DD')

        res.render('edit-note', {
            cekSesi: req.session.user_id,
            dateStart,
            deadline,
            debt,
            title: 'Edit - debt',
            layout: './layouts/main-layout'
        })
    } catch (error) {
        console.log(error)
        res.redirect('/404')
    }
})

app.get('/document/:_id', auth, async (req, res) => {
    try {
        const debt = await Debt.findOne({ _id: req.params._id })
        const interestSet = _.divide(debt.bunga, 100)
        const preDebtTotal = debt.jumlah * interestSet
        const countDebt = parseInt(debt.jumlah) + parseInt(preDebtTotal)
        res.render('document', {
            debtCount: currencyFormatter.format(debt.jumlah, { locale: 'id-ID' }),
            userName: req.session.name_user,
            preDebtTotal: currencyFormatter.format(preDebtTotal, { locale: 'id-ID' }),
            countDebt: currencyFormatter.format(countDebt, { locale: 'id-ID' }),
            formattedDeadline: moment(debt.deadline).locale('id').format('ddd, DD MMM YYYY'),
            formattedDate: moment(debt.tgl_hutang).locale('id').format('ddd, DD MMM YYYY'),
            formattedPaid: moment(debt.lunas_pada).locale('id').format('ddd, DD MMM YYYY'),
            debt,
            title: 'Invoice',
            layout: 'document'
        })
    } catch (e) {
        res.redirect('/404')
    }
})

app.put('/notes/:_id', (req, res) => {
    if (req.body.status === 'paid' || req.body.status === 'unpaid') {
        Debt.updateOne(
            {
                _id: req.body._id
            },
            {
                $set: {
                    lunas_pada: req.body.lunas_pada,
                    status: req.body.status
                }
            }).then((result) => {
                //pesan singkat /flash message
                req.flash('msg', `Status hutang ${req.body.pemberi} Berhasil diubah!`)

                res.redirect('/notes')
            })
    } else {
        if (req.body.bunga != null || typeof req.body.bunga != undefined) {
            Debt.updateOne(
                {
                    _id: req.body._id
                },
                {
                    $set: {
                        pemberi: req.body.pemberi,
                        jumlah: req.body.jumlah,
                        bunga: req.body.bunga,
                        tgl_hutang: req.body.tgl_hutang,
                        deadline: req.body.deadline,
                        catatan: req.body.catatan
                    }
                }).then((result) => {
                    //pesan singkat /flash message
                    req.flash('msg', `Status hutang ${req.body.pemberi} Berhasil diubah!`)

                    res.redirect('/notes')
                })
        } else {
            Debt.updateOne(
                {
                    _id: req.body._id
                },
                {
                    $set: {
                        pemberi: req.body.pemberi,
                        jumlah: req.body.jumlah,
                        tgl_hutang: req.body.tgl_hutang,
                        deadline: req.body.deadline,
                        catatan: req.body.catatan
                    }
                }).then((result) => {
                    //pesan singkat /flash message
                    req.flash('msg', `Status hutang ${req.body.pemberi} Berhasil diubah!`)

                    res.redirect('/notes')
                })
        }
    }
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
    console.log(`Server is running..., ctrl+click on http://localhost:${port}`)
})