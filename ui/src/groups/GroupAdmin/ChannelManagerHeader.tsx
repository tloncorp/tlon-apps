import React from "react";

export default function ChannelManagerHeader() {
  return(
    <div className="my-3 flex items-center justify-between">
      <h2 className="text-lg font-semibold">Channels</h2>
      <div>
        <button className="small-button mx-2">New Section</button>
        <button className="small-button">New Channel</button>
      </div>
    </div>
  );
}