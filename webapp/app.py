from flask import Flask, render_template, request
from flask_sqlalchemy import SQLAlchemy
from flask_bootstrap import Bootstrap
from sqlalchemy.sql.expression import func

app = Flask(__name__)
Bootstrap(app)

app.config[
    "SQLALCHEMY_DATABASE_URI"
] = "postgresql://airflow:airflow@127.0.0.1:5555/battle-rap"
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = True

db = SQLAlchemy(app)

class Rapper(db.Model):
    __tablename__ = "rappers"
    artist_id = db.Column(db.String, primary_key=True)
    artist_name = db.Column(db.String)
    popularity = db.Column(db.Integer)
    followers = db.Column(db.Integer)
    genres = db.Column(db.String)
    image_url = db.Column(db.String)
    flag_main_genre = db.Column(db.Boolean)
    flag_excl_genre = db.Column(db.Boolean)
    load_date = db.Column(db.DateTime)

    def __repr__(self):
        return f'<Artist {self.artist_name}>'

@app.route("/")
def index():
    rapper1 = (
        Rapper.query.filter(
            Rapper.flag_main_genre == True,
            Rapper.flag_excl_genre == False,
            Rapper.popularity >= 60,
            Rapper.followers >= 100000,
        )
        .order_by(func.random())
        .first()
    )
    rapper2 = (
        Rapper.query.filter(
            Rapper.flag_main_genre == True,
            Rapper.flag_excl_genre == False,
            Rapper.popularity >= 60,
            Rapper.followers >= 100000,
            Rapper.artist_id != rapper1.artist_id
        )
        .order_by(func.random())
        .first()
    )
    return render_template("list.html", rapper1=rapper1, rapper2=rapper2)#rapper2.artist_name + ' vs ' + rapper1.artist_name

@app.route("/quiz")
def user(name):
    return render_template("quiz.html", name=name)


@app.route("/ranking")
def foobar():
    return "<h1>TBD</h1>"
