import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import logoBlack from "@/assets/images/LOGO/JA black.png";
import logoWhite from "@/assets/images/LOGO/JA white.png";
import { IoArrowForward } from "react-icons/io5";

interface HomeProps {
    isDarkMode: boolean;
}

export default function Home({ isDarkMode }: HomeProps) {
    const navigate = useNavigate();

    return (
        <div className="flex flex-col items-center justify-center flex-1 p-8">
            <img
                src={isDarkMode ? logoWhite : logoBlack}
                alt="Logo"
                className="w-36 h-36 mb-6"
            />
            <h1 className="text-4xl font-bold mb-2">Weather App</h1>
            <p className="text-muted-foreground mb-8">Check weather conditions worldwide</p>
            <Button
                size="lg"
                onClick={() => navigate("/weather")}
                className="rounded-xl px-8 gap-2"
            >
                Get Started
                <IoArrowForward size={18} />
            </Button>
        </div>
    );
}
