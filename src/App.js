import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged, signInWithCustomToken } from 'firebase/auth';
import { getFirestore, doc, getDoc, setDoc, onSnapshot, collection, addDoc, updateDoc, deleteDoc, query, where, getDocs } from 'firebase/firestore';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell } from 'recharts';
import { ChevronRight, Plus, BrainCircuit, Target, DollarSign, HeartHandshake, Dumbbell, Settings, LayoutDashboard, CheckSquare, Calendar, ListTodo, Lightbulb, Bot, Sparkles, Trash2, Upload, BookUser, Sun, Moon, XCircle, FileText } from 'lucide-react';

// --- CONFIGURAZIONE FIREBASE ---
// Queste variabili vengono popolate dall'ambiente di esecuzione.
const firebaseConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : {};
const appId = typeof __app_id !== 'undefined' ? __app_id : 'life-os-default';
const initialAuthToken = typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : null;


// --- COMPONENTI DI UTILITÀ ---

// Icona per i Pilastri
const PillarIcon = ({ pillar, className }) => {
  const icons = {
    Corpo: <Dumbbell className={className} />,
    Finanze: <DollarSign className={className} />,
    Professione: <Target className={className} />,
    Mente: <BrainCircuit className={className} />,
    Relazioni: <HeartHandshake className={className} />,
  };
  return icons[pillar] || <div className={`w-6 h-6 ${className}`} />;
};

// Schermata di Caricamento
const LoadingScreen = () => (
    <div className="flex items-center justify-center h-screen bg-gray-900 text-white">
        <div className="text-center">
            <Bot size={48} className="animate-pulse mx-auto text-blue-500" />
            <p className="text-xl mt-4 font-semibold">Inizializzazione Life OS...</p>
            <p className="text-gray-400">Connessione alla tua matrice personale.</p>
        </div>
    </div>
);

// Componente Toast per le notifiche
const Toast = ({ message, type, onDismiss }) => {
    const baseStyle = "fixed top-5 right-5 p-4 rounded-lg shadow-lg flex items-center text-white z-50 transition-opacity duration-300";
    const typeStyles = {
        success: "bg-green-500",
        error: "bg-red-500",
        info: "bg-blue-500",
    };

    useEffect(() => {
        const timer = setTimeout(onDismiss, 3000);
        return () => clearTimeout(timer);
    }, [onDismiss]);

    return (
        <div className={`${baseStyle} ${typeStyles[type]}`}>
            <span>{message}</span>
            <button onClick={onDismiss} className="ml-4"><XCircle size={20} /></button>
        </div>
    );
};


// --- APP PRINCIPALE ---
export default function App() {
    // --- STATO E AUTENTICAZIONE ---
    const [page, setPage] = useState('Dashboard');
    const [db, setDb] = useState(null);
    const [auth, setAuth] = useState(null);
    const [userId, setUserId] = useState(null);
    const [isAuthReady, setIsAuthReady] = useState(false);
    const [theme, setTheme] = useState('dark');
    const [toast, setToast] = useState(null);

    // --- DATI DELL'APPLICAZIONE ---
    const [pillars, setPillars] = useState({});
    const [settings, setSettings] = useState({
        financialBudget: 6000,
        monthlySpend: 1500,
        dailyReviewQuestions: [],
        mentors: [],
        kpis: [],
    });
    const [dailyReviewStreak, setDailyReviewStreak] = useState(0);
    const [financialData, setFinancialData] = useState([]);
    const [todoList, setTodoList] = useState([]);
    const [lifeGoals, setLifeGoals] = useState([]);
    const [aiMemories, setAiMemories] = useState("");
    const [sundayShutdowns, setSundayShutdowns] = useState([]);
    const [dailyReviews, setDailyReviews] = useState([]);

    const PILLARS_CONFIG = {
        Corpo: { color: "#34D399", icon: Dumbbell },
        Finanze: { color: "#FBBF24", icon: DollarSign },
        Professione: { color: "#60A5FA", icon: Target },
        Mente: { color: "#A78BFA", icon: BrainCircuit },
        Relazioni: { color: "#F472B6", icon: HeartHandshake },
    };

    // --- FUNZIONE TOAST ---
    const showToast = (message, type = 'success') => {
        setToast({ message, type, id: Date.now() });
    };

    // --- INIZIALIZZAZIONE FIREBASE ---
    useEffect(() => {
        if (Object.keys(firebaseConfig).length > 0) {
            try {
                const app = initializeApp(firebaseConfig);
                const firestoreDb = getFirestore(app);
                const firebaseAuth = getAuth(app);
                setDb(firestoreDb);
                setAuth(firebaseAuth);

                const unsubscribe = onAuthStateChanged(firebaseAuth, async (user) => {
                    if (user) {
                        setUserId(user.uid);
                    } else {
                        if (initialAuthToken) {
                            await signInWithCustomToken(firebaseAuth, initialAuthToken);
                        } else {
                            await signInAnonymously(firebaseAuth);
                        }
                    }
                    setIsAuthReady(true);
                });
                return () => unsubscribe();
            } catch (error) {
                 console.error("Errore inizializzazione Firebase:", error);
                 setIsAuthReady(true);
            }
        } else {
            console.log("Configurazione Firebase non trovata. Controlla il tuo file .env");
            setIsAuthReady(true);
        }
    }, []);
    
    // --- GESTIONE TEMA ---
    useEffect(() => {
        document.documentElement.classList.toggle('dark', theme === 'dark');
    }, [theme]);

    const toggleTheme = () => {
        setTheme(prevTheme => prevTheme === 'dark' ? 'light' : 'dark');
    };

    // --- FETCH DEI DATI DA FIRESTORE ---
    useEffect(() => {
        if (isAuthReady && db && userId) {
            const dataSources = [
                { key: 'pillars', setter: setPillars, defaultValue: { Corpo: { xp: 0 }, Finanze: { xp: 0 }, Professione: { xp: 0 }, Mente: { xp: 0 }, Relazioni: { xp: 0 } } },
                { key: 'settings', setter: setSettings, defaultValue: { financialBudget: 6000, monthlySpend: 1500, dailyReviewQuestions: [], mentors: [], kpis: [] } },
                { key: 'dailyReviewStreak', setter: setDailyReviewStreak, defaultValue: 0 },
                { key: 'financialData', setter: setFinancialData, defaultValue: [] },
                { key: 'todoList', setter: setTodoList, defaultValue: [] },
                { key: 'lifeGoals', setter: setLifeGoals, defaultValue: [] },
                { key: 'aiMemories', setter: setAiMemories, defaultValue: "" },
                { key: 'sundayShutdowns', setter: setSundayShutdowns, defaultValue: [] },
                { key: 'dailyReviews', setter: setDailyReviews, defaultValue: [] },
            ];

            const unsubscribes = dataSources.map(source => {
                const docRef = doc(db, `artifacts/${appId}/users/${userId}/data`, source.key);
                return onSnapshot(docRef, (docSnap) => {
                    if (docSnap.exists()) {
                        source.setter(docSnap.data().value);
                    } else {
                        setDoc(docRef, { value: source.defaultValue }).catch(e => console.error(e));
                        source.setter(source.defaultValue);
                    }
                }, (error) => {
                    console.error(`Errore nel caricamento di ${source.key}:`, error);
                });
            });

            return () => unsubscribes.forEach(unsub => unsub());
        }
    }, [isAuthReady, db, userId]);

    // --- FUNZIONI DI AGGIORNAMENTO DATI ---
    const updateFirestore = useCallback(async (key, value) => {
        if (db && userId) {
            const docRef = doc(db, `artifacts/${appId}/users/${userId}/data`, key);
            try {
                await setDoc(docRef, { value });
            } catch (error) {
                console.error(`Errore nell'aggiornamento di ${key}:`, error);
                showToast(`Errore salvataggio ${key}`, 'error');
            }
        }
    }, [db, userId, showToast]);

    // --- FUNZIONI DI GAMIFICATION ---
    const calculateLevel = (xp) => {
        if (!xp) return { level: 0, currentXp: 0, nextLevelXp: 100 };
        const level = Math.floor(xp / 100);
        const currentXp = xp % 100;
        return { level, currentXp, nextLevelXp: 100 };
    };

    // --- FUNZIONI AI (GEMINI API) ---
    const callGeminiAPI = async (prompt, isJson = false) => {
        console.log("Chiamata a Gemini con il prompt:", prompt);
        const apiKey = ""; // Lasciare vuoto, verrà iniettato dall'ambiente
        const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;

        const payload = {
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {}
        };

        if (isJson) {
            payload.generationConfig.responseMimeType = "application/json";
        }

        try {
            const response = await fetch(apiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                const errorBody = await response.text();
                throw new Error(`Errore API: ${response.statusText} - ${errorBody}`);
            }

            const result = await response.json();
            
            if (result.candidates && result.candidates.length > 0 && result.candidates[0].content.parts) {
                const text = result.candidates[0].content.parts[0].text;
                if (isJson) {
                    try {
                        return JSON.parse(text);
                    } catch (e) {
                        console.error("Errore parsing JSON dalla risposta AI:", e);
                        console.error("Risposta ricevuta:", text);
                        throw new Error("La risposta dell'AI non è un JSON valido.");
                    }
                }
                return text;
            } else {
                 console.error("Struttura risposta AI inattesa:", result);
                 throw new Error("Nessuna risposta valida dall'AI.");
            }
        } catch (error) {
            console.error("Errore chiamata Gemini API:", error);
            showToast("L'AI non è riuscita a rispondere.", "error");
            return isJson ? {} : "Spiacente, non sono riuscito a elaborare la tua richiesta.";
        }
    };

    // --- RENDER ---
    if (!isAuthReady) {
        return <LoadingScreen />;
    }
    
    const renderPage = () => {
        const commonProps = {
            updateFirestore,
            PILLARS_CONFIG,
            showToast,
            callGeminiAPI,
        };

        const allData = { pillars, settings, dailyReviewStreak, financialData, todoList, lifeGoals, aiMemories, dailyReviews };

        switch (page) {
            case 'Dashboard':
                return <Dashboard {...allData} {...commonProps} calculateLevel={calculateLevel} kpis={settings.kpis} />;
            case 'Daily Review':
                return <DailyReview {...allData} {...commonProps} />;
            case 'To-Do List':
                return <TodoList {...allData} {...commonProps} />;
            case 'Finanze':
                return <Finances {...allData} {...commonProps} />;
            case 'Sunday Shutdown':
                return <SundayShutdown />;
            case 'Life Goals':
                return <LifeGoals {...allData} {...commonProps} />;
            case 'Mentor Help':
                return <MentorHelp {...allData} {...commonProps} mentors={settings.mentors || []} />;
            case 'AI Memories':
                return <AiMemories {...allData} {...commonProps} />;
            case 'Settings':
                return <SettingsPage {...allData} {...commonProps} />;
            default:
                return <Dashboard {...allData} {...commonProps} calculateLevel={calculateLevel} kpis={settings.kpis} />;
        }
    };

    return (
        <div className="flex h-screen bg-gray-100 dark:bg-gray-900 text-gray-800 dark:text-gray-200 font-sans">
            {toast && <Toast message={toast.message} type={toast.type} onDismiss={() => setToast(null)} />}
            <Sidebar currentPage={page} setPage={setPage} toggleTheme={toggleTheme} theme={theme} />
            <main className="flex-1 p-4 sm:p-6 lg:p-8 overflow-y-auto">
                {renderPage()}
            </main>
        </div>
    );
}

// --- COMPONENTI DI PAGINA ---
const Sidebar = ({ currentPage, setPage, toggleTheme, theme }) => {
    const navItems = [
        { name: 'Dashboard', icon: LayoutDashboard },
        { name: 'Daily Review', icon: CheckSquare },
        { name: 'To-Do List', icon: ListTodo },
        { name: 'Finanze', icon: DollarSign },
        { name: 'Sunday Shutdown', icon: Calendar },
        { name: 'Life Goals', icon: Target },
        { name: 'Mentor Help', icon: BookUser },
        { name: 'AI Memories', icon: BrainCircuit },
        { name: 'Settings', icon: Settings },
    ];

    return (
        <nav className="w-16 hover:w-64 transition-all duration-300 ease-in-out bg-white dark:bg-gray-950 flex flex-col border-r border-gray-200 dark:border-gray-800">
            <div className="flex items-center justify-center h-20 border-b border-gray-200 dark:border-gray-800">
                 <Bot size={32} className="text-blue-500" />
            </div>
            <ul className="flex-1 py-4">
                {navItems.map(item => (
                    <li key={item.name}>
                        <a
                            href="#"
                            onClick={(e) => { e.preventDefault(); setPage(item.name); }}
                            className={`flex items-center h-12 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 ${currentPage === item.name ? 'bg-gray-100 dark:bg-gray-800 border-r-4 border-blue-500' : ''}`}
                        >
                            <item.icon size={24} className="mx-4" />
                            <span className="font-medium overflow-hidden whitespace-nowrap">{item.name}</span>
                        </a>
                    </li>
                ))}
            </ul>
            <div className="p-4 border-t border-gray-200 dark:border-gray-800">
                <button onClick={toggleTheme} className="flex items-center w-full h-12 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg">
                    {theme === 'dark' ? <Sun size={24} className="mx-4" /> : <Moon size={24} className="mx-4" />}
                    <span className="font-medium overflow-hidden whitespace-nowrap">{theme === 'dark' ? 'Light Mode' : 'Dark Mode'}</span>
                </button>
            </div>
        </nav>
    );
};

const Dashboard = ({ pillars, calculateLevel, PILLARS_CONFIG, dailyReviewStreak, settings, financialData = [], lifeGoals = [], kpis = [], dailyReviews = [], callGeminiAPI, aiMemories, todoList = [] }) => {
    
    const [isGeneratingReport, setIsGeneratingReport] = useState(false);
    const [fullReport, setFullReport] = useState('');

    const financialRunaway = settings.monthlySpend > 0 ? (settings.financialBudget / settings.monthlySpend).toFixed(1) : '∞';
    const longGameGoal = useMemo(() => {
        if (!lifeGoals || lifeGoals.length === 0) return { text: "Aggiungi obiettivi nella sezione 'Life Goals'!" };
        const dayOfYear = Math.floor((new Date() - new Date(new Date().getFullYear(), 0, 0)) / 1000 / 60 / 60 / 24);
        return lifeGoals[dayOfYear % lifeGoals.length];
    }, [lifeGoals]);

    const dailyReviewChartData = dailyReviews.slice(-30).map(r => ({
        date: new Date(r.date).toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit' }),
        punteggio: r.totalScore,
    }));

    const generateFullReport = async () => {
        setIsGeneratingReport(true);
        setFullReport('');

        const prompt = `
        Sei il mio coach strategico personale. Analizza i seguenti dati del mio "Life OS" per generare un report completo e attuabile.

        **1. Contesto e Memoria Centrale (Chi sono):**
        ${aiMemories}

        **2. Stato Attuale dei Pilastri (XP e Livelli):**
        ${JSON.stringify(pillars)}

        **3. Obiettivi di Vita (La mia Visione a Lungo Termine):**
        ${JSON.stringify(lifeGoals)}

        **4. Task Recenti (Cosa ho fatto):**
        - Completati: ${JSON.stringify(todoList.filter(t => t.completed).slice(-10))}
        - Da fare: ${JSON.stringify(todoList.filter(t => !t.completed).slice(0,10))}

        **5. Dati Finanziari Recenti (Ultimi 3 mesi):**
        ${JSON.stringify(financialData.slice(-3))}

        **6. Daily Reviews Recenti (Ultime 7):**
        ${JSON.stringify(dailyReviews.slice(-7))}

        **TASK:**
        Basandoti su TUTTI i dati sopra, produci un report strutturato in Markdown con le seguenti sezioni:
        
        ### 1. Analisi Strategica Globale
        Una valutazione di alto livello (2-3 frasi) su come sto andando rispetto alla mia visione e ai miei obiettivi. Sto allineando le azioni quotidiane con gli obiettivi a lungo termine?
        
        ### 2. Punti di Forza e Successi Recenti
        Identifica 2-3 successi o pattern positivi evidenti dai dati (es. costanza in un pilastro, completamento di task importanti, trend finanziario positivo).
        
        ### 3. Aree di Miglioramento e Rischi
        Identifica 2-3 aree di debolezza, rischi o pattern negativi (es. un pilastro trascurato, procrastinazione su certi task, spese eccessive).
        
        ### 4. Piano d'Azione per la Prossima Settimana
        Fornisci 3 azioni concrete e prioritarie da intraprendere nella prossima settimana per affrontare le aree di miglioramento e accelerare verso gli obiettivi. Sii specifico.
        `;

        const report = await callGeminiAPI(prompt);
        setFullReport(report);
        setIsGeneratingReport(false);
    };


    return (
        <div className="space-y-6">
            <h1 className="text-3xl font-bold">Dashboard</h1>
            
            {/* Pilastri */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                {Object.entries(PILLARS_CONFIG).map(([name, config]) => {
                    const pillarData = pillars[name] || { xp: 0 };
                    const { level, currentXp, nextLevelXp } = calculateLevel(pillarData.xp);
                    const progress = (currentXp / nextLevelXp) * 100;

                    return (
                        <div key={name} className="p-4 bg-white dark:bg-gray-800 rounded-lg shadow space-y-2">
                            <div className="flex items-center space-x-3">
                                <config.icon size={24} style={{ color: config.color }} />
                                <h3 className="font-semibold text-lg">{name}</h3>
                            </div>
                            <p className="text-sm text-gray-500 dark:text-gray-400">Livello {level}</p>
                            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5">
                                <div className="h-2.5 rounded-full" style={{ width: `${progress}%`, backgroundColor: config.color }}></div>
                            </div>
                            <p className="text-right text-xs text-gray-500 dark:text-gray-400">{currentXp} / {nextLevelXp} XP</p>
                        </div>
                    );
                })}
            </div>

            {/* Widgets */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="p-4 bg-white dark:bg-gray-800 rounded-lg shadow flex items-center space-x-4">
                    <div className="text-4xl">🔥</div>
                    <div>
                        <h4 className="font-semibold">Daily Review Streak</h4>
                        <p className="text-2xl font-bold">{dailyReviewStreak} giorni</p>
                    </div>
                </div>
                <div className="p-4 bg-white dark:bg-gray-800 rounded-lg shadow">
                    <h4 className="font-semibold">Runaway Finanziario</h4>
                    <p className="text-2xl font-bold">{financialRunaway} mesi</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Autonomia con budget attuale</p>
                </div>
                <div className="p-4 bg-white dark:bg-gray-800 rounded-lg shadow">
                    <h4 className="font-semibold">Long Game: Prima di Morire</h4>
                    <p className="text-lg font-bold truncate">{longGameGoal?.text}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Obiettivo di oggi</p>
                </div>
            </div>

            {/* Report AI Section */}
            <div className="text-center">
                 <button onClick={generateFullReport} disabled={isGeneratingReport} className="inline-flex items-center gap-2 py-2 px-6 rounded-lg text-sm font-medium text-white bg-purple-600 hover:bg-purple-700 disabled:bg-gray-400">
                    {isGeneratingReport ? <><div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div> Generazione in corso...</> : <><FileText size={16} /> Genera Report Strategico</>}
                </button>
            </div>

            {fullReport && (
                <div className="p-6 bg-white dark:bg-gray-800 rounded-lg shadow">
                    <h2 className="text-2xl font-bold mb-4">Report Strategico AI</h2>
                    <div className="prose dark:prose-invert max-w-none" dangerouslySetInnerHTML={{ __html: fullReport.replace(/\n/g, '<br />') }}></div>
                </div>
            )}


            {/* Grafici */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="p-4 bg-white dark:bg-gray-800 rounded-lg shadow h-80">
                    <h4 className="font-semibold mb-4">Andamento Review Giornaliere (Ultimi 30)</h4>
                    <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={dailyReviewChartData} margin={{ top: 5, right: 20, left: -10, bottom: 20 }}>
                            <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.2} />
                            <XAxis dataKey="date" />
                            <YAxis />
                            <Tooltip contentStyle={{ backgroundColor: 'rgba(31, 41, 55, 0.8)', border: 'none' }} />
                            <Legend />
                            <Line type="monotone" dataKey="punteggio" stroke="#8884d8" strokeWidth={2} />
                        </LineChart>
                    </ResponsiveContainer>
                </div>
                
                <div className="p-4 bg-white dark:bg-gray-800 rounded-lg shadow h-80">
                    <h4 className="font-semibold mb-4">Andamento Finanziario (Ultimi 12 mesi)</h4>
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={financialData.slice(-12)} margin={{ top: 5, right: 20, left: -10, bottom: 20 }}>
                            <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.2} />
                            <XAxis dataKey="month" />
                            <YAxis />
                            <Tooltip contentStyle={{ backgroundColor: 'rgba(31, 41, 55, 0.8)', border: 'none' }} />
                            <Legend />
                            <Bar dataKey="netWorth" fill="#8884d8" name="Net Worth" />
                            <Bar dataKey="income" fill="#82ca9d" name="Income" />
                            <Bar dataKey="expenses" fill="#ffc658" name="Expenses" />
                        </BarChart>
                    </ResponsiveContainer>
                </div>

                <div className="p-4 bg-white dark:bg-gray-800 rounded-lg shadow h-80 col-span-1 lg:col-span-2">
                    <h4 className="font-semibold mb-4">Progresso KPI</h4>
                    <div className="space-y-4 overflow-y-auto h-64 pr-2">
                        {kpis.length > 0 ? kpis.map((kpi, index) => {
                             const progress = ((kpi.current - (kpi.start || 0)) / (kpi.target - (kpi.start || 0))) * 100;
                            return (
                                <div key={index}>
                                    <div className="flex justify-between mb-1">
                                        <span className="text-sm font-medium">{kpi.name}</span>
                                        <span className="text-sm font-medium">{kpi.current} / {kpi.target}</span>
                                    </div>
                                    <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5">
                                        <div className="bg-blue-600 h-2.5 rounded-full" style={{ width: `${Math.min(100, Math.max(0,progress))}%` }}></div>
                                    </div>
                                </div>
                            );
                        }) : <p className="text-gray-500 dark:text-gray-400">Nessun KPI impostato. Vai alle impostazioni per crearne uno.</p>}
                    </div>
                </div>
            </div>
        </div>
    );
};

const DailyReview = ({ settings, updateFirestore, pillars, dailyReviewStreak, callGeminiAPI, dailyReviews = [], aiMemories, showToast }) => {
    const [answers, setAnswers] = useState({});
    const [aiAnalysis, setAiAnalysis] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const today = new Date().toISOString().split('T')[0];
    const hasReviewedToday = dailyReviews.some(r => r.date === today);

    const handleCheckboxChange = (questionIndex) => {
        setAnswers(prev => ({ ...prev, [questionIndex]: !prev[questionIndex] }));
    };

    const handleSubmit = async () => {
        setIsLoading(true);
        let totalScore = 0;
        const newPillars = JSON.parse(JSON.stringify(pillars));
        const questions = settings.dailyReviewQuestions || [];
        const answeredQuestions = [];
        
        questions.forEach((q, index) => {
            if (answers[index]) {
                if (!newPillars[q.pillar]) newPillars[q.pillar] = { xp: 0 };
                newPillars[q.pillar].xp += parseInt(q.points, 10);
                totalScore += parseInt(q.points, 10);
                answeredQuestions.push({question: q.text, answer: 'Sì'});
            } else {
                answeredQuestions.push({question: q.text, answer: 'No'});
            }
        });

        const lastReview = dailyReviews.length > 0 ? dailyReviews[dailyReviews.length - 1] : null;
        let newStreak = dailyReviewStreak;
        if (lastReview) {
            const lastDate = new Date(lastReview.date);
            const todayDate = new Date(today);
            const diffTime = Math.abs(todayDate - lastDate);
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            newStreak = diffDays === 1 ? dailyReviewStreak + 1 : 1;
        } else {
            newStreak = 1;
        }
        
        const newReview = { date: today, answers, totalScore };
        const updatedReviews = [...dailyReviews, newReview];

        const prompt = `Contesto su di me: ${aiMemories}\n\nOggi ho risposto così alla mia daily review:\n${JSON.stringify(answeredQuestions)}\n\nFornisci un'analisi concisa (massimo 3 frasi) e motivante della mia giornata, collegando le risposte ai miei obiettivi generali. Sii un coach, non un semplice riassuntore.`;
        const analysis = await callGeminiAPI(prompt);
        setAiAnalysis(analysis);
        
        await updateFirestore('pillars', newPillars);
        await updateFirestore('dailyReviewStreak', newStreak);
        await updateFirestore('dailyReviews', updatedReviews);
        showToast("Review completata e salvata!");
        setIsLoading(false);
    };

    if (hasReviewedToday) {
        return (
            <div className="p-6 bg-white dark:bg-gray-800 rounded-lg shadow text-center">
                <CheckSquare size={48} className="mx-auto text-green-500 mb-4" />
                <h2 className="text-2xl font-bold">Review completata!</h2>
                <p className="text-gray-500 dark:text-gray-400">Hai già completato la review per oggi. Torna domani!</p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <h1 className="text-3xl font-bold">Daily Review</h1>
            <div className="p-6 bg-white dark:bg-gray-800 rounded-lg shadow space-y-4">
                {(settings.dailyReviewQuestions || []).map((q, index) => (
                    <div key={index} className="flex items-center justify-between p-3 rounded-md bg-gray-50 dark:bg-gray-700/50">
                        <label htmlFor={`q-${index}`} className="flex-1 cursor-pointer">{q.text}</label>
                        <div className="flex items-center space-x-4">
                            <span className="text-xs font-semibold px-2 py-1 bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 rounded-full">{q.pillar} (+{q.points} XP)</span>
                            <input
                                id={`q-${index}`}
                                type="checkbox"
                                checked={!!answers[index]}
                                onChange={() => handleCheckboxChange(index)}
                                className="h-5 w-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                            />
                        </div>
                    </div>
                ))}
                <button
                    onClick={handleSubmit}
                    disabled={isLoading}
                    className="w-full flex justify-center items-center py-3 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:bg-gray-400"
                >
                    {isLoading ? <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div> : "Completa Review e Ottieni Analisi AI"}
                </button>
            </div>
            {aiAnalysis && (
                <div className="p-6 bg-blue-50 dark:bg-gray-800 rounded-lg shadow">
                    <h3 className="text-lg font-semibold flex items-center"><Sparkles size={20} className="mr-2 text-blue-500"/> Analisi AI della Giornata</h3>
                    <p className="mt-2 text-gray-700 dark:text-gray-300">{aiAnalysis}</p>
                </div>
            )}
        </div>
    );
};

const TodoList = ({ todoList = [], updateFirestore, PILLARS_CONFIG, callGeminiAPI, pillars, showToast, aiMemories }) => {
    const [newTask, setNewTask] = useState('');
    const [selectedPillar, setSelectedPillar] = useState('Mente');
    const [points, setPoints] = useState(10);
    const [isLoading, setIsLoading] = useState(false);
    const [isPrioritizing, setIsPrioritizing] = useState(false);

    const handleAddTask = async (e) => {
      e.preventDefault();
      if(newTask.trim() === '') return;
      const newTodo = { id: Date.now() + Math.random(), text: newTask, pillar: selectedPillar, points: parseInt(points, 10), completed: false };
      const newTodos = [...todoList, newTodo];
      await updateFirestore('todoList', newTodos);
      setNewTask('');
    };

    const subdivideWithAI = async () => {
        if (newTask.trim() === '') return;
        setIsLoading(true);
        const prompt = `Suddividi questo obiettivo principale in una lista di 3-5 sotto-task concreti e attuabili. Obiettivo: "${newTask}". Rispondi con un oggetto JSON con una singola chiave "tasks" che contiene un array di stringhe. Esempio: {"tasks": ["Ricerca dati iniziali", "Definizione della struttura del report", "Scrittura della bozza"]}.`;
        
        const result = await callGeminiAPI(prompt, true);
        
        if (result && Array.isArray(result.tasks) && result.tasks.length > 0) {
            const subTasks = result.tasks.map(subtaskText => ({
                id: Date.now() + Math.random(),
                text: subtaskText,
                pillar: selectedPillar,
                points: Math.ceil(points / result.tasks.length),
                completed: false,
                parent: newTask,
            }));
            
            const newTodos = [...todoList, ...subTasks];
            await updateFirestore('todoList', newTodos);
            showToast("Task suddiviso con successo!", "success");

        } else {
            console.error("Risposta AI non valida per la suddivisione:", result);
            showToast("L'AI non ha fornito una suddivisione valida.", "error");
        }

        setNewTask('');
        setIsLoading(false);
    };

    const definePriorities = async () => {
        setIsPrioritizing(true);
        const openTasks = todoList.filter(t => !t.completed);
        const taskTexts = openTasks.map((t, i) => `${i}: ${t.text}`).join('\n');
        const prompt = `Contesto su di me e i miei obiettivi: ${aiMemories}\n\nQuesta è la mia To-Do List attuale:\n${taskTexts}\n\nAnalizza la lista e i miei obiettivi. Identifica 1 task a priorità alta, fino a 3 a priorità media e fino a 5 a priorità bassa. Rispondi con un oggetto JSON con chiavi "alta", "media", "bassa", contenenti gli indici numerici dei task. Esempio: {"alta": [2], "media": [0, 4], "bassa": [1, 3]}`;
        
        const result = await callGeminiAPI(prompt, true);

        if (result && result.alta) {
            const newTodos = todoList.map(t => ({...t, priority: 'Nessuna'})); // Reset
            const setPriority = (index, priority) => {
                const originalId = openTasks[index].id;
                const todoInNewList = newTodos.find(t => t.id === originalId);
                if (todoInNewList) todoInNewList.priority = priority;
            };

            if (result.alta) result.alta.forEach(i => setPriority(i, 'Alta'));
            if (result.media) result.media.forEach(i => setPriority(i, 'Media'));
            if (result.bassa) result.bassa.forEach(i => setPriority(i, 'Bassa'));

            await updateFirestore('todoList', newTodos);
            showToast("Priorità definite dall'AI!", "success");
        } else {
            showToast("L'AI non ha definito le priorità.", "error");
        }
        setIsPrioritizing(false);
    };

    const toggleComplete = async (id) => {
        let completedTask = null;
        const newTodos = todoList.map(todo => {
            if (todo.id === id) {
                const updatedTodo = { ...todo, completed: !todo.completed };
                if (updatedTodo.completed) {
                    completedTask = updatedTodo;
                }
                return updatedTodo;
            }
            return todo;
        });

        if (completedTask) {
            const newPillars = JSON.parse(JSON.stringify(pillars));
            if (!newPillars[completedTask.pillar]) newPillars[completedTask.pillar] = { xp: 0 };
            newPillars[completedTask.pillar].xp += completedTask.points;
            await updateFirestore('pillars', newPillars);
            showToast(`+${completedTask.points} XP per ${completedTask.pillar}!`, "info");
        }
        
        await updateFirestore('todoList', newTodos);
    };
    
    const deleteTask = async (id) => {
        const newTodos = todoList.filter(todo => todo.id !== id);
        await updateFirestore('todoList', newTodos);
        showToast("Task eliminato.", "info");
    };
    
    const priorityOrder = { 'Alta': 1, 'Media': 2, 'Bassa': 3, 'Nessuna': 4 };
    const sortedTodos = [...todoList].filter(t => !t.completed).sort((a, b) => (priorityOrder[a.priority || 'Nessuna']) - (priorityOrder[b.priority || 'Nessuna']));

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="text-3xl font-bold">To-Do List</h1>
                <button onClick={definePriorities} disabled={isPrioritizing} className="flex items-center gap-2 py-2 px-4 rounded-md text-sm font-medium text-white bg-purple-600 hover:bg-purple-700 disabled:bg-gray-400">
                    {isPrioritizing ? <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div> : <Lightbulb size={16} />}
                    Definisci Priorità con AI
                </button>
            </div>
            <div className="p-4 bg-white dark:bg-gray-800 rounded-lg shadow">
                <form onSubmit={handleAddTask} className="flex flex-wrap items-center gap-4">
                    <input
                        type="text"
                        value={newTask}
                        onChange={(e) => setNewTask(e.target.value)}
                        placeholder="Nuovo obiettivo..."
                        className="flex-grow p-2 border rounded-md bg-gray-50 dark:bg-gray-700 dark:border-gray-600 focus:ring-blue-500 focus:border-blue-500"
                    />
                    <select value={selectedPillar} onChange={(e) => setSelectedPillar(e.target.value)} className="p-2 border rounded-md bg-gray-50 dark:bg-gray-700 dark:border-gray-600">
                        {Object.keys(PILLARS_CONFIG).map(p => <option key={p} value={p}>{p}</option>)}
                    </select>
                    <input type="number" value={points} onChange={(e) => setPoints(e.target.value)} className="w-20 p-2 border rounded-md bg-gray-50 dark:bg-gray-700 dark:border-gray-600" />
                    <button type="submit" className="flex items-center gap-2 py-2 px-4 rounded-md text-sm font-medium text-white bg-blue-600 hover:bg-blue-700">
                        <Plus size={16} /> Aggiungi
                    </button>
                    <button type="button" onClick={subdivideWithAI} disabled={isLoading} className="flex items-center gap-2 py-2 px-4 rounded-md text-sm font-medium text-white bg-green-600 hover:bg-green-700 disabled:bg-gray-400">
                        {isLoading ? <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div> : <Sparkles size={16} />}
                         Suddividi con AI
                    </button>
                </form>
            </div>
            <div className="space-y-3">
                {sortedTodos.map(todo => (
                     <div key={todo.id} className="flex items-center p-3 bg-white dark:bg-gray-800 rounded-lg shadow-sm">
                        <input type="checkbox" checked={todo.completed} onChange={() => toggleComplete(todo.id)} className="h-5 w-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500 mr-4" />
                        <span className="flex-grow">{todo.text}</span>
                        {todo.priority && todo.priority !== 'Nessuna' && (
                            <span className={`text-xs font-bold px-2 py-1 rounded-full mr-4 ${
                                todo.priority === 'Alta' ? 'bg-red-500 text-white' : 
                                todo.priority === 'Media' ? 'bg-yellow-500 text-white' : 'bg-gray-500 text-white'
                            }`}>{todo.priority}</span>
                        )}
                        <span className="text-xs font-semibold px-2 py-1 rounded-full mr-4" style={{ backgroundColor: `${PILLARS_CONFIG[todo.pillar]?.color}20`, color: PILLARS_CONFIG[todo.pillar]?.color }}>
                            {todo.pillar} (+{todo.points} XP)
                        </span>
                        <button onClick={() => deleteTask(todo.id)} className="text-gray-400 hover:text-red-500"><Trash2 size={16}/></button>
                    </div>
                ))}
            </div>
             <div>
                <h2 className="text-xl font-semibold mt-8 mb-4">Completati</h2>
                {todoList.filter(t => t.completed).map(todo => (
                     <div key={todo.id} className="flex items-center p-3 bg-white/50 dark:bg-gray-800/50 rounded-lg shadow-sm mb-2">
                        <input type="checkbox" checked={todo.completed} onChange={() => toggleComplete(todo.id)} className="h-5 w-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500 mr-4" />
                        <span className="flex-grow line-through text-gray-500">{todo.text}</span>
                        <span className="text-xs font-semibold px-2 py-1 rounded-full mr-4" style={{ backgroundColor: `${PILLARS_CONFIG[todo.pillar]?.color}20`, color: PILLARS_CONFIG[todo.pillar]?.color }}>
                            {todo.pillar}
                        </span>
                    </div>
                ))}
            </div>
        </div>
    );
};

const Finances = ({ financialData = [], updateFirestore, showToast }) => {
    const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
    const [netWorth, setNetWorth] = useState('');
    const [income, setIncome] = useState('');
    const [expenses, setExpenses] = useState('');
    const [editingIndex, setEditingIndex] = useState(null);

    const handleSubmit = async (e) => {
        e.preventDefault();
        const newEntry = { month, netWorth: parseFloat(netWorth), income: parseFloat(income), expenses: parseFloat(expenses) };
        let updatedData;
        const existingEntryIndex = financialData.findIndex(d => d.month === month);

        if (editingIndex !== null) { // Editing existing
            updatedData = [...financialData];
            updatedData[editingIndex] = newEntry;
        } else if (existingEntryIndex !== -1) { // Trying to add for a month that exists
            updatedData = [...financialData];
            updatedData[existingEntryIndex] = newEntry;
        }
        else { // Adding new
            updatedData = [...financialData, newEntry];
        }

        updatedData.sort((a, b) => new Date(a.month) - new Date(b.month));
        await updateFirestore('financialData', updatedData);
        showToast("Dati finanziari salvati!", "success");
        setMonth(new Date().toISOString().slice(0, 7));
        setNetWorth('');
        setIncome('');
        setExpenses('');
        setEditingIndex(null);
    };

    const handleEdit = (index) => {
        const data = financialData[index];
        setMonth(data.month);
        setNetWorth(data.netWorth);
        setIncome(data.income);
        setExpenses(data.expenses);
        setEditingIndex(index);
    };

    return (
        <div className="space-y-6">
            <h1 className="text-3xl font-bold">Andamento Finanziario</h1>
            <div className="p-6 bg-white dark:bg-gray-800 rounded-lg shadow">
                <h2 className="text-xl font-semibold mb-4">{editingIndex !== null ? 'Modifica Dati Mensili' : 'Inserisci Dati Mensili'}</h2>
                <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 items-end">
                    <div className="flex flex-col">
                        <label className="text-sm font-medium mb-1">Mese</label>
                        <input type="month" value={month} onChange={e => setMonth(e.target.value)} required className="p-2 border rounded-md bg-gray-50 dark:bg-gray-700 dark:border-gray-600" />
                    </div>
                    <div className="flex flex-col">
                        <label className="text-sm font-medium mb-1">Net Worth (€)</label>
                        <input type="number" value={netWorth} onChange={e => setNetWorth(e.target.value)} placeholder="es. 24000" required className="p-2 border rounded-md bg-gray-50 dark:bg-gray-700 dark:border-gray-600" />
                    </div>
                    <div className="flex flex-col">
                        <label className="text-sm font-medium mb-1">Income (€)</label>
                        <input type="number" value={income} onChange={e => setIncome(e.target.value)} placeholder="es. 3000" required className="p-2 border rounded-md bg-gray-50 dark:bg-gray-700 dark:border-gray-600" />
                    </div>
                    <div className="flex flex-col">
                        <label className="text-sm font-medium mb-1">Expenses (€)</label>
                        <input type="number" value={expenses} onChange={e => setExpenses(e.target.value)} placeholder="es. 1500" required className="p-2 border rounded-md bg-gray-50 dark:bg-gray-700 dark:border-gray-600" />
                    </div>
                    <button type="submit" className="w-full py-2 px-4 rounded-md text-sm font-medium text-white bg-blue-600 hover:bg-blue-700">{editingIndex !== null ? 'Salva Modifiche' : 'Aggiungi/Aggiorna Dati'}</button>
                </form>
            </div>
            <div className="p-6 bg-white dark:bg-gray-800 rounded-lg shadow">
                <h2 className="text-xl font-semibold mb-4">Storico Dati</h2>
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="border-b dark:border-gray-700">
                                <th className="p-2">Mese</th>
                                <th className="p-2">Net Worth</th>
                                <th className="p-2">Income</th>
                                <th className="p-2">Expenses</th>
                                <th className="p-2">Azioni</th>
                            </tr>
                        </thead>
                        <tbody>
                            {[...financialData].reverse().map((data, index) => (
                                <tr key={index} className="border-b dark:border-gray-700">
                                    <td className="p-2">{data.month}</td>
                                    <td className="p-2">€{data.netWorth.toLocaleString('it-IT')}</td>
                                    <td className="p-2">€{data.income.toLocaleString('it-IT')}</td>
                                    <td className="p-2">€{data.expenses.toLocaleString('it-IT')}</td>
                                    <td className="p-2"><button onClick={() => handleEdit(financialData.length - 1 - index)} className="text-blue-500 hover:underline">Modifica</button></td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

const SettingsPage = ({ settings, updateFirestore, PILLARS_CONFIG, showToast }) => {
    const [activeTab, setActiveTab] = useState('Generale');
    const [localSettings, setLocalSettings] = useState(settings);
    const [newMentor, setNewMentor] = useState('');

    useEffect(() => {
        // Assicura che i campi non siano undefined
        const sanitizedSettings = {
            ...settings,
            dailyReviewQuestions: settings.dailyReviewQuestions || [],
            kpis: settings.kpis || [],
            mentors: settings.mentors || [],
        };
        setLocalSettings(sanitizedSettings);
    }, [settings]);

    const handleSave = () => {
        updateFirestore('settings', localSettings);
        showToast('Impostazioni salvate!', 'success');
    };

    const handleQuestionChange = (index, field, value) => {
        const newQuestions = [...localSettings.dailyReviewQuestions];
        newQuestions[index][field] = value;
        setLocalSettings(prev => ({ ...prev, dailyReviewQuestions: newQuestions }));
    };
    
    const addQuestion = () => {
        const newQuestions = [...localSettings.dailyReviewQuestions, { text: '', pillar: 'Mente', points: 10 }];
        setLocalSettings(prev => ({ ...prev, dailyReviewQuestions: newQuestions }));
    };

    const removeQuestion = (index) => {
        const newQuestions = localSettings.dailyReviewQuestions.filter((_, i) => i !== index);
        setLocalSettings(prev => ({ ...prev, dailyReviewQuestions: newQuestions }));
    };
    
    const handleKpiChange = (index, field, value) => {
        const newKpis = [...localSettings.kpis];
        newKpis[index][field] = value;
        setLocalSettings(prev => ({ ...prev, kpis: newKpis }));
    };
    
    const addKpi = () => {
        const newKpis = [...localSettings.kpis, { name: '', start: 0, current: 0, target: 100 }];
        setLocalSettings(prev => ({ ...prev, kpis: newKpis }));
    };

    const removeKpi = (index) => {
        const newKpis = localSettings.kpis.filter((_, i) => i !== index);
        setLocalSettings(prev => ({ ...prev, kpis: newKpis }));
    };
    
    const addMentor = () => {
        if (newMentor.trim() === '') return;
        const newMentors = [...localSettings.mentors, newMentor.trim()];
        setLocalSettings(prev => ({ ...prev, mentors: newMentors }));
        setNewMentor('');
    };
    
    const removeMentor = (mentorToRemove) => {
        const newMentors = localSettings.mentors.filter(m => m !== mentorToRemove);
        setLocalSettings(prev => ({...prev, mentors: newMentors}));
    };

    const tabs = ['Generale', 'Daily Review', 'KPI', 'Mentori'];

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="text-3xl font-bold">Impostazioni</h1>
                <button onClick={handleSave} className="py-2 px-4 rounded-md text-sm font-medium text-white bg-blue-600 hover:bg-blue-700">Salva Impostazioni</button>
            </div>
            <div className="flex border-b dark:border-gray-700">
                {tabs.map(tab => (
                    <button key={tab} onClick={() => setActiveTab(tab)} className={`py-2 px-4 font-medium ${activeTab === tab ? 'border-b-2 border-blue-500 text-blue-500' : 'text-gray-500'}`}>
                        {tab}
                    </button>
                ))}
            </div>
            <div className="p-6 bg-white dark:bg-gray-800 rounded-lg shadow">
                {activeTab === 'Generale' && (
                    <div className="space-y-4">
                        <h3 className="text-xl font-semibold">Impostazioni Finanziarie</h3>
                         <div>
                            <label className="block text-sm font-medium">Budget Totale (€)</label>
                            <input type="number" value={localSettings.financialBudget} onChange={e => setLocalSettings({...localSettings, financialBudget: parseFloat(e.target.value)})} className="mt-1 block w-full p-2 border rounded-md bg-gray-50 dark:bg-gray-700 dark:border-gray-600" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium">Spesa Mensile Stimata (€)</label>
                            <input type="number" value={localSettings.monthlySpend} onChange={e => setLocalSettings({...localSettings, monthlySpend: parseFloat(e.target.value)})} className="mt-1 block w-full p-2 border rounded-md bg-gray-50 dark:bg-gray-700 dark:border-gray-600" />
                        </div>
                    </div>
                )}
                {activeTab === 'Daily Review' && (
                     <div className="space-y-4">
                        <div className="flex justify-between items-center">
                            <h3 className="text-xl font-semibold">Domande della Daily Review</h3>
                            <button onClick={addQuestion} className="flex items-center gap-2 py-2 px-3 rounded-md text-sm font-medium text-white bg-green-600 hover:bg-green-700"><Plus size={16}/> Aggiungi Domanda</button>
                        </div>
                        {localSettings.dailyReviewQuestions.map((q, index) => (
                            <div key={index} className="grid grid-cols-1 md:grid-cols-4 gap-4 items-center p-3 bg-gray-50 dark:bg-gray-700/50 rounded-md">
                                <input type="text" value={q.text} onChange={e => handleQuestionChange(index, 'text', e.target.value)} placeholder="Testo della domanda" className="col-span-2 p-2 border rounded-md bg-white dark:bg-gray-700 dark:border-gray-600" />
                                <select value={q.pillar} onChange={e => handleQuestionChange(index, 'pillar', e.target.value)} className="p-2 border rounded-md bg-white dark:bg-gray-700 dark:border-gray-600">
                                    {Object.keys(PILLARS_CONFIG).map(p => <option key={p} value={p}>{p}</option>)}
                                </select>
                                <div className="flex items-center gap-2">
                                    <input type="number" value={q.points} onChange={e => handleQuestionChange(index, 'points', parseInt(e.target.value))} className="w-full p-2 border rounded-md bg-white dark:bg-gray-700 dark:border-gray-600" />
                                    <button onClick={() => removeQuestion(index)} className="text-gray-400 hover:text-red-500"><Trash2 size={18}/></button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
                {activeTab === 'KPI' && (
                     <div className="space-y-4">
                        <div className="flex justify-between items-center">
                            <h3 className="text-xl font-semibold">Key Performance Indicators (KPI)</h3>
                            <button onClick={addKpi} className="flex items-center gap-2 py-2 px-3 rounded-md text-sm font-medium text-white bg-green-600 hover:bg-green-700"><Plus size={16}/> Aggiungi KPI</button>
                        </div>
                        {localSettings.kpis.map((kpi, index) => (
                            <div key={index} className="grid grid-cols-1 md:grid-cols-5 gap-4 items-center p-3 bg-gray-50 dark:bg-gray-700/50 rounded-md">
                                <input type="text" value={kpi.name} onChange={e => handleKpiChange(index, 'name', e.target.value)} placeholder="Nome KPI (es. Patrimonio)" className="col-span-2 p-2 border rounded-md bg-white dark:bg-gray-700 dark:border-gray-600" />
                                <input type="number" value={kpi.current} onChange={e => handleKpiChange(index, 'current', parseFloat(e.target.value))} placeholder="Valore Attuale" className="p-2 border rounded-md bg-white dark:bg-gray-700 dark:border-gray-600" />
                                <input type="number" value={kpi.target} onChange={e => handleKpiChange(index, 'target', parseFloat(e.target.value))} placeholder="Obiettivo" className="p-2 border rounded-md bg-white dark:bg-gray-700 dark:border-gray-600" />
                                <button onClick={() => removeKpi(index)} className="text-gray-400 hover:text-red-500 justify-self-center"><Trash2 size={18}/></button>
                            </div>
                        ))}
                    </div>
                )}
                {activeTab === 'Mentori' && (
                    <div className="space-y-4">
                        <h3 className="text-xl font-semibold">Gestisci Mentori AI</h3>
                        <div className="flex gap-2">
                            <input 
                                type="text" 
                                value={newMentor}
                                onChange={(e) => setNewMentor(e.target.value)}
                                placeholder="Nome del mentore (es. Kobe Bryant)"
                                className="flex-grow p-2 border rounded-md bg-gray-50 dark:bg-gray-700 dark:border-gray-600"
                            />
                            <button onClick={addMentor} className="py-2 px-4 rounded-md text-sm font-medium text-white bg-green-600 hover:bg-green-700">Aggiungi</button>
                        </div>
                        <div className="space-y-2">
                            {localSettings.mentors.map(mentor => (
                                <div key={mentor} className="flex justify-between items-center p-2 bg-gray-100 dark:bg-gray-700/50 rounded-md">
                                    <span>{mentor}</span>
                                    <button onClick={() => removeMentor(mentor)} className="text-gray-400 hover:text-red-500"><Trash2 size={16}/></button>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

const LifeGoals = ({ lifeGoals = [], updateFirestore, PILLARS_CONFIG, callGeminiAPI, showToast, todoList = [], aiMemories }) => {
    const [newGoal, setNewGoal] = useState('');
    const [selectedPillar, setSelectedPillar] = useState('Professione');
    const [aiSuggestion, setAiSuggestion] = useState(null);
    const [isLoading, setIsLoading] = useState(false);

    const addGoal = async () => {
        if (newGoal.trim() === '') return;
        const updatedGoals = [...lifeGoals, { id: Date.now(), text: newGoal, pillar: selectedPillar }];
        await updateFirestore('lifeGoals', updatedGoals);
        showToast("Obiettivo di vita aggiunto!", "success");
        setNewGoal('');
    };

    const removeGoal = async (id) => {
        const updatedGoals = lifeGoals.filter(g => g.id !== id);
        await updateFirestore('lifeGoals', updatedGoals);
        showToast("Obiettivo rimosso.", "info");
    };

    const askAI = async () => {
        setIsLoading(true);
        const prompt = `Contesto: ${aiMemories}\n\nObiettivi di vita: ${lifeGoals.map(g => g.text).join(', ')}\n\nScegli uno degli obiettivi e suggerisci una piccola, concreta azione che posso fare OGGI per avvicinarmi. Formula la risposta come un task da aggiungere alla to-do list. Rispondi solo con il testo del task.`;
        const suggestion = await callGeminiAPI(prompt);
        setAiSuggestion(suggestion);
        setIsLoading(false);
    };
    
    const addSuggestionToTodo = async () => {
        if (!aiSuggestion) return;
        const newTodos = [...todoList, { id: Date.now(), text: aiSuggestion, pillar: 'Mente', points: 15, completed: false }];
        await updateFirestore('todoList', newTodos);
        showToast("Task suggerito aggiunto alla To-Do List!", "success");
        setAiSuggestion(null);
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="text-3xl font-bold">Life Goals (Prima di Morire)</h1>
                <button onClick={askAI} disabled={isLoading} className="flex items-center gap-2 py-2 px-4 rounded-md text-sm font-medium text-white bg-purple-600 hover:bg-purple-700 disabled:bg-gray-400">
                    {isLoading ? <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div> : <Lightbulb size={16} />}
                     Chiedi all'AI
                </button>
            </div>

            {aiSuggestion && (
                <div className="p-4 bg-purple-50 dark:bg-gray-800 rounded-lg shadow">
                    <h3 className="text-lg font-semibold flex items-center"><Sparkles size={20} className="mr-2 text-purple-500"/> Suggerimento AI</h3>
                    <p className="mt-2">{aiSuggestion}</p>
                    <div className="mt-4 flex gap-4">
                        <button onClick={addSuggestionToTodo} className="py-2 px-4 rounded-md text-sm font-medium text-white bg-green-600 hover:bg-green-700">Aggiungi alla To-Do List</button>
                        <button onClick={() => setAiSuggestion(null)} className="py-2 px-4 rounded-md text-sm font-medium text-gray-700 bg-gray-200 hover:bg-gray-300">Chiudi</button>
                    </div>
                </div>
            )}

            <div className="p-4 bg-white dark:bg-gray-800 rounded-lg shadow flex gap-4">
                <input type="text" value={newGoal} onChange={e => setNewGoal(e.target.value)} placeholder="Nuovo obiettivo di vita..." className="flex-grow p-2 border rounded-md bg-gray-50 dark:bg-gray-700 dark:border-gray-600" />
                <select value={selectedPillar} onChange={e => setSelectedPillar(e.target.value)} className="p-2 border rounded-md bg-gray-50 dark:bg-gray-700 dark:border-gray-600">
                    {Object.keys(PILLARS_CONFIG).map(p => <option key={p} value={p}>{p}</option>)}
                </select>
                <button onClick={addGoal} className="flex items-center gap-2 py-2 px-4 rounded-md text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"><Plus size={16}/> Aggiungi</button>
            </div>

            <div className="space-y-3">
                {lifeGoals.map(goal => (
                    <div key={goal.id} className="flex items-center p-4 bg-white dark:bg-gray-800 rounded-lg shadow-sm">
                        <PillarIcon pillar={goal.pillar} className={`w-6 h-6 mr-4`} style={{color: PILLARS_CONFIG[goal.pillar]?.color}} />
                        <span className="flex-grow font-medium">{goal.text}</span>
                        <button onClick={() => removeGoal(goal.id)} className="text-gray-400 hover:text-red-500"><Trash2 size={16}/></button>
                    </div>
                ))}
            </div>
        </div>
    );
};

const MentorHelp = ({ mentors = [], callGeminiAPI, aiMemories, showToast }) => {
    const [selectedMentor, setSelectedMentor] = useState('');
    const [selectedDoubt, setSelectedDoubt] = useState('');
    const [aiResponse, setAiResponse] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const doubts = [
        "Non so cosa fare!",
        "Qual è la mia priorità?",
        "Come sto andando?",
        "Dammi un consiglio valutando la mia situazione!",
    ];

    const getHelp = async () => {
        if (!selectedMentor || !selectedDoubt) {
            showToast("Seleziona un mentore e un dubbio.", "error");
            return;
        }
        setIsLoading(true);
        setAiResponse('');
        const prompt = `Agisci come se fossi il mio mentore, ${selectedMentor}. Sii diretto, saggio e incisivo come lui. Basandoti su queste informazioni che ho condiviso su di me: "${aiMemories}", rispondi a questa mia richiesta specifica: "${selectedDoubt}". Fornisci una risposta strategica e attuabile.`;
        const response = await callGeminiAPI(prompt);
        setAiResponse(response);
        setIsLoading(false);
    };

    return (
        <div className="space-y-6">
            <h1 className="text-3xl font-bold">Mentor Help</h1>
            <div className="p-6 bg-white dark:bg-gray-800 rounded-lg shadow space-y-4">
                <h2 className="text-xl font-semibold">Chiedi aiuto a un mentore</h2>
                <select value={selectedMentor} onChange={e => setSelectedMentor(e.target.value)} className="w-full p-2 border rounded-md bg-gray-50 dark:bg-gray-700 dark:border-gray-600">
                    <option value="">-- Seleziona un mentore --</option>
                    {mentors.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
                <select value={selectedDoubt} onChange={e => setSelectedDoubt(e.target.value)} className="w-full p-2 border rounded-md bg-gray-50 dark:bg-gray-700 dark:border-gray-600">
                    <option value="">-- Seleziona il tuo dubbio --</option>
                    {doubts.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
                <button onClick={getHelp} disabled={isLoading} className="w-full flex justify-center items-center py-3 px-4 rounded-md text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400">
                    {isLoading ? <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div> : "Ottieni Risposta"}
                </button>
            </div>
            {isLoading && <div className="p-6 bg-blue-50 dark:bg-gray-800 rounded-lg shadow text-center">Analizzando la situazione...</div>}
            {aiResponse && (
                <div className="p-6 bg-blue-50 dark:bg-gray-800 rounded-lg shadow">
                    <h3 className="text-lg font-semibold flex items-center"><BookUser size={20} className="mr-2 text-blue-500"/> Risposta da {selectedMentor}</h3>
                    <p className="mt-2 whitespace-pre-wrap font-serif">{aiResponse}</p>
                </div>
            )}
        </div>
    );
};

const AiMemories = ({ aiMemories, updateFirestore, showToast }) => {
    const [memories, setMemories] = useState(aiMemories);
    const [selectedFile, setSelectedFile] = useState(null);

    useEffect(() => {
        setMemories(aiMemories);
    }, [aiMemories]);

    const handleSave = () => {
        updateFirestore('aiMemories', memories);
        showToast('Memorie AI salvate!', 'success');
    };
    
    const handleFileChange = (event) => {
        const file = event.target.files[0];
        if (file) {
            setSelectedFile(file);
            showToast(`File "${file.name}" selezionato.`, 'info');
            // Qui andrebbe la logica di upload e processamento
        }
    };

    return (
        <div className="space-y-6">
             <div className="flex justify-between items-center">
                <h1 className="text-3xl font-bold">Memorie AI</h1>
                <button onClick={handleSave} className="py-2 px-4 rounded-md text-sm font-medium text-white bg-blue-600 hover:bg-blue-700">Salva Memorie</button>
            </div>
            <div className="p-6 bg-white dark:bg-gray-800 rounded-lg shadow space-y-4">
                <h2 className="text-xl font-semibold">Cosa deve sapere l'AI su di te?</h2>
                <p className="text-sm text-gray-500 dark:text-gray-400">Inserisci qui informazioni, principi, obiettivi e contesto. L'AI userà queste memorie per personalizzare le sue risposte.</p>
                <textarea
                    value={memories}
                    onChange={e => setMemories(e.target.value)}
                    rows={15}
                    className="w-full p-2 border rounded-md bg-gray-50 dark:bg-gray-700 dark:border-gray-600"
                    placeholder="Es: Il mio obiettivo principale è raggiungere l'indipendenza finanziaria. Valuto la disciplina sopra ogni cosa..."
                />
            </div>
             <div className="p-6 bg-white dark:bg-gray-800 rounded-lg shadow space-y-4">
                <h2 className="text-xl font-semibold">Carica Documenti</h2>
                <p className="text-sm text-gray-500 dark:text-gray-400">Carica PDF o altri documenti per arricchire la conoscenza dell'AI.</p>
                <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-300 dark:border-gray-600 border-dashed rounded-md">
                    <div className="space-y-1 text-center">
                        <Upload className="mx-auto h-12 w-12 text-gray-400" />
                        <div className="flex text-sm text-gray-600 dark:text-gray-400">
                            <label htmlFor="file-upload" className="relative cursor-pointer bg-white dark:bg-gray-800 rounded-md font-medium text-blue-600 hover:text-blue-500 focus-within:outline-none">
                                <span>Carica un file</span>
                                <input id="file-upload" name="file-upload" type="file" className="sr-only" onChange={handleFileChange} />
                            </label>
                            <p className="pl-1">o trascinalo qui</p>
                        </div>
                        <p className="text-xs text-gray-500 dark:text-gray-500">PDF, DOCX fino a 10MB</p>
                    </div>
                </div>
                {selectedFile && <p className="text-center text-sm text-gray-500">File selezionato: {selectedFile.name}</p>}
            </div>
        </div>
    );
};

const SundayShutdown = () => {
    // Placeholder component
    return (
        <div className="space-y-6">
            <h1 className="text-3xl font-bold">Sunday Shutdown</h1>
            <div className="p-6 bg-white dark:bg-gray-800 rounded-lg shadow text-center">
                <h2 className="text-2xl font-bold">Review Settimanale</h2>
                <p className="text-gray-500 dark:text-gray-400">Questa sezione è in fase di sviluppo. Torna presto per rivedere la tua settimana, analizzare le vittorie e gli ostacoli, e pianificare quella successiva!</p>
            </div>
        </div>
    );
};
