import os
from dotenv import load_dotenv
from datetime import datetime
import uuid

from flask import Flask, render_template, request
from flask_sqlalchemy import SQLAlchemy
from flask_bootstrap import Bootstrap
from sqlalchemy.sql.expression import func

app = Flask(__name__)
Bootstrap(app)

load_dotenv()
sqlalchemy_conn = os.getenv("SUPABASE_URI")#os.getenv("POSTGRES_CONN")

app.config["SQLALCHEMY_DATABASE_URI"] = sqlalchemy_conn
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
    flag_latin_genre = db.Column(db.Boolean)
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


class Results(db.Model):
    __tablename__ = "results"
    matchup_id = db.Column(db.String, primary_key=True)
    winner_id = db.Column(db.String)
    loser_id = db.Column(db.String)
    voted_at = db.Column(db.DateTime)

    def __init__(self, matchup_id, winner_id, loser_id, voted_at):
        self.matchup_id = matchup_id
        self.winner_id = winner_id
        self.loser_id = loser_id
        self.voted_at = voted_at

class Ranking(db.Model):
    __tablename__ = "rankings"
    artist_id = db.Column(db.String, primary_key=True)
    artist_name = db.Column(db.String)
    popularity = db.Column(db.Integer)
    followers = db.Column(db.Integer)
    wins = db.Column(db.Integer)
    losses = db.Column(db.Integer)
    win_rate = db.Column(db.Float)

@app.route("/", methods=["GET", "POST"])
def vote():
    if request.method == "POST":
        matchup_id = uuid.uuid4()
        voted_at = datetime.now()

        if request.form.get("vote1"):
            winner_id, loser_id = request.form.get("vote1").split("_")
            record = Results(matchup_id, winner_id, loser_id, voted_at)
            db.session.add(record)
            db.session.commit()
        elif request.form.get("vote2"):
            winner_id, loser_id = request.form.get("vote2").split("_")
            record = Results(matchup_id, winner_id, loser_id, voted_at)
            db.session.add(record)
            db.session.commit()

    rapper1 = (
        Rapper.query.filter(
            Rapper.flag_main_genre == True,
            Rapper.flag_excl_genre == False,
            Rapper.flag_latin_genre == False,
            Rapper.popularity >= 70,
            Rapper.followers >= 100000,
        )
        .order_by(func.random())
        .first()
    )
    rapper2 = (
        Rapper.query.filter(
            Rapper.flag_main_genre == True,
            Rapper.flag_excl_genre == False,
            Rapper.flag_latin_genre == False,
            Rapper.popularity >= 70,
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
        "vote.html",
        rapper1=rapper1,
        rapper2=rapper2,
        tracks1=tracks1,
        tracks2=tracks2,
    )
    
@app.route("/about")
def about():
    return render_template("about.html")

@app.route("/ranking")
def ranking():
    artists_ranked = Ranking.query.all()
    return render_template("ranking.html", artists=artists_ranked)

@app.route("/visualize")
def visualize():
    return render_template("visualize.html")



