import axios from "axios";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import VideoPlayer from "../components/VideoPlayer";
import GoLive from "../components/GoLive";

const Home = () => {
  const [user, setUser] = useState({
    _id: "",
    name: "",
    email: "",
    streamKey: "9f068c5b-3853-4a0a-86d4-b22a25025f11",
    isLive: false,
  });


  useEffect(() => {
    const u = localStorage.getItem("user");
    if (u) {
      setUser(JSON.parse(u));
    }
  }, []);

  const handleRegister = () => {
    axios
      .post("http://localhost:5555/regenerate", { streamKey: user.streamKey })
      .then(({ data }) => {
        localStorage.setItem("user", JSON.stringify(data));
        setUser(data);
      })
      .catch((err) => {
        console.log(err);
      });
  };

  // const streamUrl = `http://localhost:8888/player.html?url=http://localhost:8888/live/${user.streamKey}.m3u8`; // Adjust based on your setup
  const streamUrl = `http://localhost:8888/hls/${user.streamKey}.m3u8`; // Adjust based 
  
  return (
    <div className="flex gap-5 flex-col h-full">
      <header className="max-w-[500px] py-10 mx-auto">
        <Link to="/posts" className="text-blue-500">
          posts
        </Link>
      </header>

      <div className="max-w-[500px] mx-auto flex-1 flex-col gap-5">
        <h1>Welcome to the Homepage</h1>
        <p>This is the Homepage.</p>
        <div className="bg-blue-500 p-5 text-white flex flex-col gap-4">
          <span>{user.name}</span>
          <span>{user.email}</span>
          <span>{user.isLive}</span>
          <div className="flex gap-4">
            <span
              onClick={() => {
                navigator.clipboard.writeText(user.streamKey);
                alert("Stream key copied to clipboard");
              }}
            >
              {user.streamKey}
            </span>
            <button
              onClick={handleRegister}
              className="bg-black text-white font-bold px-4 py-2"
            >
              reganarate key
            </button>
          </div>
        </div>
        <div className="flex gap-4 w-full items-center">
          <div>
            <GoLive id={user._id as string} />
          </div>

          <VideoPlayer streamUrl={streamUrl} />
        </div>
      </div>

      <div>
        {/* <StreamAnalytics /> */}

      </div>

      <footer className="max-w-[500px] py-10 mx-auto">
        <p>�� 2024 My Website</p>
      </footer>
    </div>
  );
};

export default Home;
