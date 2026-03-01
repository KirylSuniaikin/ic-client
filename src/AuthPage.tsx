import {useState} from "react";
import {initiateAuth} from "./management/api/api";
import {useLocation, useNavigate} from "react-router-dom";
import {Box, Button, CircularProgress, TextField, IconButton} from "@mui/material";
import InputAdornment from '@mui/material/InputAdornment';
import Typography from '@mui/material/Typography';
import ErrorSnackbar from "./adminComponents/ErrorSnackbar";
import * as React from "react";
import { Visibility, VisibilityOff } from '@mui/icons-material';
import {useAuth} from "./management/security/AuthProvider";
const brandRed = "#E44B4C";
const brandRedHover = "#CC4344";
const brandGray = "#f3f3f3";
const brandWhite = "#fff";

export function AuthPage() {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [errorMessage, setErrorMessage] = useState('');
    const [errorSnackBarOpen, setErrorSnackBarOpen] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const {login} = useAuth();

    const navigate = useNavigate();
    const location = useLocation();

    const from = location.state?.from?.pathname || '/admin';


    const logoImg = require('./assets/logo.png');

    const handleLogin = async (e: React.FormEvent) => {
        setLoading(true);
        e.preventDefault();
        setErrorMessage('');

        try {
            const res = await initiateAuth({username: username, password: password});
            const data = await res.json();
            if (!res.ok) {
                const errorMessage = "Failed to login";
                setErrorMessage(data.message ? data.message : errorMessage);
                setErrorSnackBarOpen(true);
                return;
            }

            login(data.token)

            localStorage.setItem("jwt_token", data.token);

            navigate(from, {replace: true});
        } catch (e) {
            setErrorMessage(e.message ? e.message : errorMessage);
            setErrorSnackBarOpen(true);
        } finally {
            setLoading(false);
        }
    }

    return (
        <>
            <Box sx={{ display: 'flex', minHeight: '100vh', backgroundColor: brandWhite }}>

                <Box
                    sx={{
                        display: { xs: 'none', md: 'flex' },
                        flex: 1,
                        backgroundColor: brandGray,
                        alignItems: 'center',
                        justifyContent: 'center',
                        borderRight: '1px solid #E0E0E0'
                    }}
                >
                    <Box
                        component="img"
                        src={logoImg}
                        alt="IC Pizza Logo"
                        sx={{
                            width: '50%',
                            maxWidth: '400px',
                            borderRadius: '50%',
                            boxShadow: '0 10px 30px rgba(0,0,0,0.1)'
                        }}
                    />
                </Box>


                <Box
                    sx={{
                        display: 'flex',
                        flex: 1,
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: { xs: 3, sm: 6, md: 8 },
                        backgroundColor: brandWhite
                    }}
                >
                    <Box sx={{ width: '100%', maxWidth: '400px' }}>

                        <Box
                            sx={{
                                display: { xs: 'flex', md: 'none' },
                                justifyContent: 'center',
                                mb: 4
                            }}
                        >
                            <Box
                                component="img"
                                src={logoImg}
                                alt="IC Pizza Logo"
                                sx={{ width: '170px', borderRadius: '50%' }}
                            />
                        </Box>

                        <Typography
                            variant="h4"
                            component="h1"
                            fontWeight="bold"
                            color="#1A1A24"
                            sx={{ mb: 1, fontSize: { xs: '2rem', md: '2.5rem' } }}
                        >
                            Hello,<br/>Welcome back
                        </Typography>

                        <Typography variant="body1" color="textSecondary" sx={{ mb: 4 }}>
                            Login to your Account
                        </Typography>

                        <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

                            <TextField
                                label="Username"
                                variant="outlined"
                                fullWidth
                                required
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                disabled={loading}
                                sx={{
                                    '& .MuiOutlinedInput-root': { borderRadius: '10px' }
                                }}
                            />

                            <TextField
                                label="Password"
                                type={showPassword ? 'text' : 'password'}
                                variant="outlined"
                                fullWidth
                                required
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                disabled={loading}
                                InputProps={{
                                    endAdornment: (
                                        <InputAdornment position="end">
                                            <IconButton onClick={() => setShowPassword(!showPassword)} edge="end">
                                                {showPassword ? <VisibilityOff /> : <Visibility />}
                                            </IconButton>
                                        </InputAdornment>
                                    )
                                }}
                                sx={{
                                    '& .MuiOutlinedInput-root': { borderRadius: '10px' }
                                }}
                            />

                            <Button
                                type="submit"
                                variant="contained"
                                size="large"
                                fullWidth
                                disabled={loading || username.length === 0 || password.length === 0}
                                sx={{
                                    mt: 2,
                                    py: 1.8,
                                    borderRadius: '10px',
                                    backgroundColor: brandRed,
                                    textTransform: 'none',
                                    fontSize: '1.1rem',
                                    fontWeight: 'bold',
                                    boxShadow: '0 4px 14px 0 rgba(90, 81, 230, 0.39)',
                                    '&:hover': {
                                        backgroundColor: brandRedHover,
                                    }
                                }}
                            >
                                {loading ? <CircularProgress size={26} color="inherit" /> : 'Login'}
                            </Button>
                        </form>

                    </Box>
                </Box>

            </Box>

            <ErrorSnackbar
                open={errorSnackBarOpen}
                message={errorMessage}
                severity="error"
                handleClose={() => setErrorSnackBarOpen(false)}/>
        </>
    );
}