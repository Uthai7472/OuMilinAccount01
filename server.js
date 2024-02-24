require('dotenv').config();
const express = require('express');
// const mysql = require('mysql2/promise');
const mysql = require('mysql');
const session = require('express-session');
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
const path = require('path');
const fs = require('fs');

const port = 1707;

const app = express();
app.use(cookieParser());
app.set("view engine", "ejs");
app.use(express.static('public'));
app.use('/static', express.static(path.join(__dirname, 'static')));
// Set the views directory
app.set('views', './views');
// Parse JSON bodies
app.use(bodyParser.json());

const server = app.listen(port, '0.0.0.0', () => {
    console.log(`Server is running on port ${port}`);
})

const connection = mysql.createPool({
    host: process.env.MYSQL_HOSTNAME,
    port: process.env.MYSQL_PORT,
    user: process.env.MYSQL_USERNAME,
    password: process.env.MYSQL_PASSWORD,
    database: process.env.MYSQL_DB,  
});


const sessionMiddleware = session({
    secret: 'SessionSecretKey',
    resave: false,
    saveUninitialized: true,
});
app.use(sessionMiddleware);
app.use(express.json());
app.use(express.static('static'));
app.use(bodyParser.urlencoded({ extended: true }));
const isAuthenticated = (req, res, next) => {
    if (req.cookies.isAuthenticated) {
        next();
    }
    else {
        res.redirect('/');
    }
};




app.get('/', async (req, res) => {
    try {
        await connection.query(`
            CREATE TABLE IF NOT EXISTS tb_familyUser (id INT PRIMARY KEY AUTO_INCREMENT,
                username VARCHAR(20), password VARCHAR(20))
        `, (err, results) => {
            if (err) {
                console.log(err);
                res.send(err);
            } else {
                console.log('CREATE TABLE tb_user success');
            }
        });
        await connection.query(`
            CREATE TABLE IF NOT EXISTS tb_account (id INT PRIMARY KEY AUTO_INCREMENT,
                date DATE, category VARCHAR(30), detail VARCHAR(50), price INT, note VARCHAR(100))
        `, (err, results) => {
            if (err) {
                console.log(err);
                res.send(err);
            } else {
                console.log('CREATE TABLE tb_account success');
            }
        });
        // await connection.query(`
        //     ALTER TABLE tb_account ADD month VARCHAR(20);
        // `, (err, results) => {
        //     if (err) {
        //         console.log(err);
        //         res.send(err);
        //     } else {
        //         console.log('ADD column TABLE tb_account success');
        //     }
        // });
        // await connection.query(`
        //     INSERT INTO tb_familyUser (username, password) VALUES ('ou', 'ou')
        // `, (err, results) => {
        //     if (err) {
        //         console.log(err);
        //         res.send(err);
        //     } else {
        //         console.log('INSERT TABLE tb_familyUser success');
        //     }
        // });


        res.render('login_page');

    } catch (error) {
        console.error("Error : ", error);
        res.status(500);
    }
});
app.post('/login', async (req, res) => {
    try {
        const username = req.body.username;
        const password = req.body.password;

        console.log("Username, password", username, password);

        const get_users = await new Promise((resolve, reject) => {
            connection.query(`
                SELECT * FROM tb_familyUser
                WHERE username = ? AND password = ? 
            `, [username, password], (err, results) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(results);
                }
            });
        });

        console.log(Boolean(get_users), !get_users[0])

        if (!get_users[0]) {
            res.redirect('/');
        } else {
            req.session.isAuthenticated = true;
            res.cookie('isAuthenticated', true);

            res.redirect(`/main_page?username=${username}`);
        }

    } catch (error) {
        console.error("Error : ", error);
        res.status(500);
    }
});


app.get('/main_page', isAuthenticated, async (req, res) => {
    try {
        const username = req.query.username;

        if (!username) {
            // res.redirect('/');
            res.render('main_page', {username});
        } else {
            res.render('main_page', {username});
        }


    } catch (error) {
        console.error("Error : ", error);
        res.status(500);
    }
});

app.get('/data_page', isAuthenticated, async (req, res) => {
    try {
        const get_months = await new Promise((resolve, reject) => {
            connection.query(`
                SELECT id, month FROM tb_account 
                GROUP BY month
            `, (err, results) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(results);
                    
                }
            });
        });

        console.log("Month name: ", get_months);
        
        res.render('data_page', {get_months});

    } catch (error) {
        console.error("Error : ", error);
        res.status(500);
    }
});
app.post('/data_page/add_month', async (req, res) => {
    try {
        const month_name = req.body.month_name;

        const insert_month = await new Promise((resolve, reject) => {
            connection.query(`
                INSERT INTO tb_account (month) VALUES (?) 
            `, [month_name], (err, results) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(results);
                    console.log("Insert month name success");
                    res.redirect('/data_page');
                }
            });
        });


    } catch (error) {
        console.error("Error : ", error);
        res.status(500);
    }
});
app.get('/data_page/delete_month', isAuthenticated, async (req, res) => {
    try {
        const id = req.query.id;
        console.log("ID :", id);

        const delete_month = await new Promise((resolve, reject) => {
            connection.query(`
                DELETE FROM tb_account WHERE id = ?
            `, [id], (err, results) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(results);
                    console.log("Delete month name success");
                    res.redirect('/data_page');
                }
            });
        });

    } catch (error) {
        console.error("Error : ", error);
        res.status(500);
    }
});


app.get('/data_page/detail', isAuthenticated, async (req, res) => {
    try {
        const month_name = req.query.month;
        console.log(month_name);

        const get_note = await new Promise((resolve, reject) => {
            connection.query(`
                SELECT note FROM tb_account WHERE month = ?
            `, [month_name], (err, results) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(results);
                }
            });
        });
        console.log("Note: ", get_note);

        const get_history = await new Promise((resolve, reject) => {
            connection.query(`
                SELECT * FROM tb_account WHERE month = ?
                ORDER BY date
            `, [month_name], (err, results) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(results);
                }
            });
        });

        const get_sum = await new Promise((resolve, reject) => {
            connection.query(`
                SELECT SUM(price) AS sumPrice FROM tb_account WHERE month = ?
            `, [month_name], (err, results) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(results);
                }
            });
        });
        // console.log("Note: ", get_note);
        // console.log("GetHistory: ", get_history[1].date);
        // console.log("Get SUM: ", get_sum[0].sumPrice);

        res.render('detail_page', {month_name, get_note, get_history, get_sum});

    } catch (error) {
        console.error("Error : ", error);
        res.status(500);
    }
});
app.post('/data_page/detail/save_note', async (req, res) => {
    try {
        const month = req.body.month;
        const note = req.body.note;

        console.log("Month, Note:", month, note);

        const save_remark = await new Promise((resolve, reject) => {
            connection.query(`
                UPDATE tb_account SET note = ? WHERE month = ?
            `, [note, month], (err, results) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(results);
                    console.log("Save note success");
                    res.redirect(`/data_page/detail?month=${month}`);
                }
            });
        });

    } catch (error) {
        console.error("Error : ", error);
        res.status(500);
    }
});
app.post('/data_page/detail/add', async (req, res) => {
    try {
        const month = req.body.month;
        const date = req.body.date;
        const category = req.body.category;
        const detail = req.body.detail;
        const price = parseInt(req.body.price);
        const note = req.body.note;

        console.log("Month :", month);
        console.log("date :", date);
        console.log("category :", category);
        console.log("detail :", detail);
        console.log("price :", month);
        console.log("note :", note);

        const delete_null = await new Promise((resolve, reject) => {
            connection.query(`
                DELETE FROM tb_account WHERE month = ? AND date IS NULL
            `, [month], (err, results) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(results);
                    console.log("DELETE All datas NULL success");
                }
            });
        });

        const insert_datas = await new Promise((resolve, reject) => {
            connection.query(`
                INSERT INTO tb_account (date, category, detail, price, month, note) VALUES (?, ?, ?, ?, ?, ?)
            `, [date, category, detail, price, month, note], (err, results) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(results);
                    console.log("Save All datas success");
                    res.redirect(`/data_page/detail?month=${month}`);
                }
            });
        });

    } catch (error) {
        console.error("Error : ", error);
        res.status(500);
    }
});
app.get('/data_page/detail/delete', isAuthenticated, async (req, res) => {
    try {
        const id = req.query.id;
        const month = req.query.month;

        const delete_data = await new Promise((resolve, reject) => {
            connection.query(`
                DELETE FROM tb_account WHERE id = ?
            `, [id], (err, results) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(results);
                    console.log("DELETE datas from id success");
                    res.redirect(`/data_page/detail?month=${month}`);
                }
            });
        });


    } catch (error) {
        console.error("Error : ", error);
        res.status(500);
    }
});


app.get('/dashboard', isAuthenticated, async (req, res) => {
    try {
        let month = req.query.month;
        if (!month) {
            month = "";
        }
        console.log("Month receive:", month);

        const get_months = await new Promise((resolve, reject) => {
            connection.query(`
                SELECT month FROM tb_account
                GROUP BY month
            `, (err, results) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(results);
                }
            });
        });

        const get_datas = await new Promise((resolve, reject) => {
            connection.query(`
                SELECT SUM(price) AS sumPrice, category FROM tb_account
                WHERE month = ? GROUP BY category
            `, [month], (err, results) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(results);
                }
            });
        });
        // console.log(get_datas.category)
        const categories = get_datas.map((row) => row.category);
        const prices = get_datas.map((row) => row.sumPrice);

        console.log(categories);

        res.render('dashboard', {get_months, categories, prices});

    } catch (error) {
        console.error("Error : ", error);
        res.status(500);
    }
});
app.post('/dashboard/search', async (req, res) => {
    try {
        const month = req.body.month;

        console.log(month);

        res.redirect(`/dashboard?month=${month}`);

    } catch (error) {
        console.error("Error : ", error);
        res.status(500);
    }
})

app.get('/logout', async (req, res) => {
    res.clearCookie('isAuthenticated'); // Clear the isAuthenticated cookie
    
    res.redirect('/');
})