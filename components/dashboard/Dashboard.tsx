"use client";

import { useEffect, useState } from "react";
import { useFleetStream } from "@/lib/hooks/useFleetStream";
import TopBar from "./TopBar";
import SidePanel from "@/components/panel/SidePanel";
import PortMap from "@/components/map/PortMap";
import PhoneSplash from "@/components/splash/PhoneSplash";

export default function Dashboard() {
  const [isPhone, setIsPhone] = useState(false);
  useFleetStream();

  useEffect(() => {
    const check = () => setIsPhone(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  if (isPhone) return <PhoneSplash />;

  return (
    <div className="fixed inset-0 flex flex-col">
      <TopBar />
      <div className="relative flex-1 overflow-hidden">
        <PortMap />
        <SidePanel />
      </div>
    </div>
  );
}
