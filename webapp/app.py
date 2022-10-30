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

class Tracks(db.Model):
    __tablename__ = "top_tracks"
    track_id = db.Column(db.String, primary_key=True)
    artist_id = db.Column(db.String)
    track_name = db.Column(db.String)
    track_rank = db.Column(db.Integer)
    track_url = db.Column(db.String)
    preview_url = db.Column(db.String)
    load_date = db.Column(db.DateTime)

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
            Rapper.artist_id != rapper1.artist_id,
        )
        .order_by(func.random())
        .first()
    )
    tracks1 = Tracks.query.filter(
        Tracks.artist_id == rapper1.artist_id, Tracks.track_rank <= 3
    ).all()

    tracks2 = Tracks.query.filter(
        Tracks.artist_id == rapper2.artist_id, Tracks.track_rank <= 3
    ).all()
    return render_template(
        "bootstrap.html",
        rapper1=rapper1,
        rapper2=rapper2,
        tracks1=tracks1,
        tracks2=tracks2,
    )


@app.route("/ranking")
def foobar():
    return "<h1>TBD</h1>"
