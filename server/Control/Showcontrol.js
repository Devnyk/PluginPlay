import axios from "axios";
import Movie from "../models/Movie.js";
import Show from "../models/Show.js";
import { inngest } from "../Inngest/index.js";

// Get popular movies from TMDB API
export const getnowplayingMovies = async (req, res) => {
  console.log("🚀 getnowplayingMovies API called");
  console.log(
    "🔑 Environment check - TMDB_API_KEY exists:",
    !!process.env.TMDB_API_KEY
  );
  console.log(
    "🔑 API Key (first 10 chars):",
    process.env.TMDB_API_KEY?.substring(0, 10) + "..."
  );

  try {
    console.log("📡 Making request to TMDB API...");
    const { data } = await axios.get(
      "https://api.themoviedb.org/3/movie/popular",
      {
        params: {
          api_key: process.env.TMDB_API_KEY,
          language: "en-US",
          page: 1,
        },
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
  timeout: 20000, // 20 second timeout (increased to reduce false timeouts)
      }
    );

    console.log("✅ API Response received");
    console.log("📊 Data type:", typeof data);
    console.log("📊 Results count:", data.results?.length);
    console.log("📝 Sample movie:", data.results?.[0]?.title);

    // Transform TMDB data to match your frontend expectations
    const movies = data.results.map((movie) => ({
      id: movie.id.toString(),
      originalTitle: movie.title,
      primaryImage: movie.poster_path
        ? `https://image.tmdb.org/t/p/w500${movie.poster_path}`
        : null,
      thumbnails: movie.backdrop_path
        ? `https://image.tmdb.org/t/p/w780${movie.backdrop_path}`
        : null,
      description: movie.overview,
      releaseDate: movie.release_date,
      averageRating: movie.vote_average,
      numVotes: movie.vote_count,
      genres: movie.genre_ids, // You might want to map these to actual genre names
      popularity: movie.popularity,
    }));

    console.log("✅ Sending response to frontend");
    res.json({ success: true, movies: movies });
    return;
  } catch (error) {
    console.error("❌ ERROR in getnowplayingMovies:");
    console.error("❌ Error message:", error.message);
    console.error("❌ Response status:", error.response?.status);
    console.error("❌ Response data:", error.response?.data);
    console.error("❌ Request config:", error.config?.url);
    // If TMDB is unreachable (network error or timeout), return cached movies from DB if available
    try {
      console.log("🔁 Attempting fallback: loading movies from local DB...");
      const cached = await Movie.find({})
        .sort({ popularity: -1 })
        .limit(20)
        .lean();

      if (cached && cached.length > 0) {
        console.log("✅ Fallback succeeded - returning", cached.length, "movies from DB");
        
        // Transform cached movies to match frontend expectations (convert _id to id)
        const transformedMovies = cached.map(movie => ({
          ...movie,
          id: movie._id
        }));
        
        return res.json({
          success: true,
          source: "cache",
          message:
            "TMDB unreachable; returning cached movies from the database.",
          movies: transformedMovies,
        });
      }
    } catch (fallbackError) {
      console.error("❌ Fallback error:", fallbackError.message);
    }

    // No cached data available - return the original error
    res.json({
      success: false,
      message: "TMDB fetch failed: " + (error?.message || "unknown error"),
      details: error.response?.data,
    });
  }
};

// Admin can add any movie from TMDB to database
export const addshow = async (req, res) => {
  try {
    console.log("🎭 addshow API called");
    const { movieId, showsInput, showprice } = req.body;
    console.log("📋 Request body:", {
      movieId,
      showsInputLength: showsInput?.length,
      showprice,
    });

    let movie = await Movie.findById(movieId);

    if (!movie) {
      console.log("🔍 Movie not found in DB, fetching from TMDB API...");
      const moviedataResponse = await axios.get(
        `https://api.themoviedb.org/3/movie/${movieId}`,
        {
          params: {
            api_key: process.env.TMDB_API_KEY,
            language: "en-US",
            append_to_response: "credits,videos",
          },
        }
      );

      const moviedata = moviedataResponse.data;
      console.log("🎬 Movie data received:", moviedata?.title);

      // Get genre names
      const genreNames = moviedata.genres?.map((g) => g.name) || [];

      // Get cast (first 10 actors)
      const cast =
        moviedata.credits?.cast?.slice(0, 10).map((actor) => ({
          name: actor.name,
          character: actor.character,
          profile_path: actor.profile_path,
        })) || [];

      // Get trailer
      const trailerVideo = moviedata.videos?.results?.find(
        (video) => video.type === "Trailer" && video.site === "YouTube"
      );
      const trailerUrl = trailerVideo
        ? `https://www.youtube.com/watch?v=${trailerVideo.key}`
        : null;

      const movieDetails = {
        _id: moviedata.id.toString(),
        originalTitle: moviedata.title,
        description: moviedata.overview,
        primaryImage: moviedata.poster_path
          ? `https://image.tmdb.org/t/p/w500${moviedata.poster_path}`
          : null,
        thumbnails: moviedata.backdrop_path
          ? `https://image.tmdb.org/t/p/w780${moviedata.backdrop_path}`
          : null,
        trailer: trailerUrl,
        releaseDate: moviedata.release_date,
        original_language:
          moviedata.spoken_languages?.map((lang) => lang.english_name) || [],
        genres: genreNames,
        casts: cast,
        averageRating: moviedata.vote_average,
        runtime: moviedata.runtime,
        numVotes: moviedata.vote_count,
        popularity: moviedata.popularity,
      };

      movie = await Movie.create(movieDetails);
      console.log("✅ Movie created in database");
    }

    const showstoCreate = [];
    showsInput.forEach((show) => {
      const showdate = show.date;
      const time = show.time;
      const datetimeString = `${showdate}T${time}`;
      showstoCreate.push({
        movie: movieId,
        showDateTime: new Date(datetimeString),
        showprice,
        occupiedSeats: {},
      });
    });

    if (showstoCreate.length > 0) {
      await Show.insertMany(showstoCreate);
      console.log("✅ Shows created:", showstoCreate.length);
    }

    await inngest.send({
      name: "app/show.added",
      data: { movieId: movie._id },
    });

    console.log("🎉 Show added successfully");
    res.json({ success: true, message: "Show(s) added successfully." });
  } catch (error) {
    console.error("❌ ERROR in addshow:", error.message);
    res.json({ success: false, message: error.message });
  }
};

// Get all unique movies from database
export const getmovies = async (req, res) => {
  try {
    console.log("📚 getmovies API called");
    const shows = await Show.find({ showDateTime: { $gte: new Date() } })
      .populate("movie")
      .sort({ showDateTime: 1 });
    console.log("📊 Found shows:", shows.length);

    const uniqueshows = new Set(shows.map((show) => show.movie));
    console.log("🎬 Unique movies:", uniqueshows.size);

    res.json({ success: true, shows: Array.from(uniqueshows) });
  } catch (error) {
    console.error("❌ ERROR in getmovies:", error.message);
    res.json({ success: false, message: error.message });
  }
};

// Get Single movie from database
export const getmovie = async (req, res) => {
  try {
    console.log("🎬 getmovie API called");
    const { movieId } = req.params;
    console.log("🆔 Movie ID:", movieId);

    const shows = await Show.find({
      movie: movieId,
      showDateTime: { $gte: new Date() },
    });
    const movie = await Movie.findById(movieId);

    console.log("📊 Found shows for movie:", shows.length);
    console.log("🎬 Movie found:", !!movie);

    const datetime = {};

    shows.forEach((show) => {
      const date = show.showDateTime.toISOString().split("T")[0];
      if (!datetime[date]) {
        datetime[date] = [];
      }
      datetime[date].push({ time: show.showDateTime, showId: show._id });
    });

    res.json({ success: true, movie, datetime });
  } catch (error) {
    console.error("❌ ERROR in getmovie:", error.message);
    res.json({ success: false, message: error.message });
  }
};
