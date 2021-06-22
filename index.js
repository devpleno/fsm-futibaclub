require('dotenv').config()
const express = require('express')
const app = express()
const mysql = require('mysql2/promise')
const bodyParser = require('body-parser')
const session = require('express-session')

const account = require('./account')
const admin = require('./admin')
const groups = require('./groups')

const host = process.env.HOST || 'localhost'
const port = process.env.PORT || '3306'
const user = process.env.USER || 'root'
const password = process.env.PASSWORD || 'devpleno'
const database = process.env.DATABASE || 'futibaclub'

/* Database Access */
const confsDatabase = { host, port, user, password, database }

app.use(express.static('public'))
app.use(bodyParser.urlencoded({ extended: true }))
app.use(session({
    secret: 'fullstack-academy',
    saveUninitialized: true,
    resave: true
}))
app.set('view engine', 'ejs')

const init = async () => {
    const connection = await mysql.createConnection(confsDatabase)

    app.use((req, res, next) => {
        if (req.session.user) {
            res.locals.user = req.session.user
        } else {
            res.locals.user = false
        }
        next()
    })

    app.use(account(connection))
    app.use('/admin', admin(connection))
    app.use('/groups', groups(connection))

    let classification = null
    app.get('/classification', async (req, res) => {
        if (classification) {
            res.render('classification', { ranking: classification })
        } else {
            const query = `
                    select
                        users.id, 
                        users.name,
                        sum(guessings.score) as score
                    from users
                    left join
                        guessings
                            on guessings.user_id = users.id
                    group by users.id
                    order by score DESC`

            const [rows] = await connection.execute(query)
            classification = rows
            res.render('classification', { ranking: rows })
        }
    })

    app.listen(3000, err => console.log('Futiba Club is running...'))
}

init()