import logo from './logo.svg';
import './App.css';
import {createTheme, CssBaseline, ThemeProvider} from "@mui/material";
import {useMemo} from "react";
import HomePage from "../../src/HomePage";

function App() {

    const theme = useMemo(
        () =>
            createTheme({
                palette: {
                    mode: 'light', // Жестко задаем светлую тему
                    primary: {
                        main: "#E44B4C"
                    },
                    background: {
                        default: "#fbfaf6", // Ваш фирменный фон
                        paper: "#ffffff",
                    },
                    text: {
                        primary: "#000000",
                        secondary: "#555555"
                    }
                },
                components: {
                    MuiTypography: {
                        styleOverrides: {
                            root: {
                                color: "#000000" // Принудительно черный текст
                            }
                        }
                    }
                }
            }),
        [],
    );


    return (
        <>
            <ThemeProvider theme={theme}>
                <CssBaseline/>
                <HomePage/>
            </ThemeProvider>
            <div className="App">
                <header className="App-header">
                    <img src={logo} className="App-logo" alt="logo"/>
                    <p>
                        Edit <code>src/App.js</code> and save to reload.
                    </p>
                    <a
                        className="App-link"
                        href="https://reactjs.org"
                        target="_blank"
                        rel="noopener noreferrer"
                    >
                        Learn React
                    </a>
                </header>
            </div>
        </>
    );
}

export default App;
