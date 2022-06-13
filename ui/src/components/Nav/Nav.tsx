import React from "react";
import {useParams} from 'react-router-dom';
import Sidebar from "../Sidebar/Sidebar";
import GroupSidebar from "../GroupSidebar";
import DMSidebar from "../../dms/DMSidebar";
import useNavStore from "./useNavStore";
import useIsChat from "../../logic/useIsChat";



export default function Nav() {
  const {ship} = useParams();

  const navLocation = useNavStore((s) => s.location);
  const isChat = useIsChat();
  let selectedSidebar = <Sidebar />;

  if (navLocation === 'main') {
    selectedSidebar = <Sidebar />;
  } else if (navLocation === "dm") {
    selectedSidebar = <DMSidebar />;
  } else if (navLocation === 'group') {
    selectedSidebar = <GroupSidebar />;
  }

  return selectedSidebar;
}