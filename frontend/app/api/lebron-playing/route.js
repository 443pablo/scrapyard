function getDayBeforeISOString(date) {
  if (!(date instanceof Date)) {
    date = new Date(date);
  }
  if (isNaN(date)) {
    return "Invalid Date";
  }

  const previousDay = new Date(date);
  previousDay.setDate(date.getDate() - 1);
  return previousDay.toISOString().split("T")[0]; // Return in YYYY-MM-DD format
}

export async function GET() {
  const url = new URL(`https://api.balldontlie.io/v1/games?dates[]=${new Date().toISOString().split("T")[0]}&dates[]=${getDayBeforeISOString(new Date())}&team_ids[]=${14}`);

  const data = await fetch(url, {
    headers: {
      Authorization: "64176ed6-9167-4cc3-a3e5-46fe32939619",
    },
  });
  
  const dataJson = await data.json();
  console.log(dataJson);
  const playing = dataJson["data"].map((game) => {
    const gametime = new Date(game.datetime);
    const now = new Date();
    if (now < gametime) {
      console.log("time");
      return false;
    }
    if (game.status === "Final") {
      console.log("game finished");
      return false;
    }
    return true;
  });
  
  return Response.json({ playing: playing.includes(true) });
}
