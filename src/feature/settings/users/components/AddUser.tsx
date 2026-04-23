import { useState } from 'react';
import { Button } from "@/components/ui/Button";
import { Save, Loader2 } from "lucide-react";
import { createUser } from "../libs/usersApi";
import toast from 'react-hot-toast';

export default function AddUser({ onClose }: { onClose?: () => void }) {
    const [email, setEmail] = useState('');
    const [name, setName] = useState('');
    const [password, setPassword] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');

    const handleSubmit = async () => {
        if (!email || !name || !password) {
            setError('Email, Name, and Password are required');
            return;
        }

        setIsLoading(true);
        setError('');

        try {
            await createUser(email, name, password);
            toast.success('User invitation sent successfully');
            setEmail('');
            setName('');
            setPassword('');
            onClose?.(); // Close the modal when invite is successful
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to add user');
            toast.error(err instanceof Error ? err.message : 'Failed to add user');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="py-8 px-6">
            {error && <div className="mb-4 p-3 bg-red-100 text-red-700 rounded">{error}</div>}
            <div className="border-[#E4E4E7] border-[1px] rounded-xl">
                <h2 className="text-base font-semibold leading-6 tracking-0 text-[#09090B] px-3 py-4">Send Invitation</h2>
                <hr className="text-[#E4E4E7] " />
                <div className="px-3 py-4">
                    <h5 className="font-medium text-sm leading-[20px] tracking-[0px] text-black ">Email</h5>
                    <input
                        className="w-full rounded-md border border-[#E4E4E7] bg-white px-4 py-1.5 pr-10 text-sm font-normal text-[#09090B] outline-none mt-1.5"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="user@example.com"
                    />
                    <h5 className="font-medium text-sm leading-[20px] tracking-[0px] text-black mt-3">User Name</h5>
                    <input
                        className="w-full rounded-md border border-[#E4E4E7] bg-white px-4 py-1.5 pr-10 text-sm font-normal text-[#09090B] outline-none mt-1.5"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="John Doe"
                    />
                    <h5 className="font-medium text-sm leading-[20px] tracking-[0px] text-black mt-3">Password</h5>
                    <input
                        className="w-full rounded-md border border-[#E4E4E7] bg-white px-4 py-1.5 pr-10 text-sm font-normal text-[#09090B] outline-none mt-1.5"
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Secure password"
                    />
                    <Button
                        className="whitespace-nowrap bg-black mt-4 !w-auto"
                        onClick={handleSubmit}
                        disabled={isLoading}
                    >
                        {isLoading ? <Loader2 className="text-[#FAFAFA] h-4 w-4 animate-spin" /> : <Save className="text-[#FAFAFA] h-4 w-4" />}
                        <span className="text-[#FAFAFA]">Send Invitation</span>
                    </Button>
                </div>
            </div>
        </div>
    );
}
