import React from 'react';
import { FoodItem } from '../models/types.ts';
import './DocumentationPage.css';

/**
 * DocumentationPage
 * Explains system rules, unit logic, and parsing behavior.
 * Derived from system constants and logic.
 */
export function DocumentationPage({ headless = false }: { headless?: boolean }) {
    return (
        <div className="documentation-page">
            {!headless && (
                <header className="doc-header">
                    <h1>📚 Systemdokumentation & Regler</h1>
                    <p>Här hittar du reglerna som styr hur recept tolkas, timers skapas och enheter omvandlas.</p>
                </header>
            )}

            <main className="doc-content">
                <section className="doc-section">
                    <h2>⏱ Smart Timer Inference</h2>
                    <p>Systemet analyserar receptsteg för att hitta tidsangivelser automatiskt.</p>

                    <div className="rule-card">
                        <h3>Automatiska Timers</h3>
                        <p>Följande mönster skapar en timer automatiskt:</p>
                        <ul>
                            <li><code>(ca 10 min)</code> - Parentes med 'ca'</li>
                            <li><code>koka i 20 min</code> - Verb + preposition</li>
                            <li><code>15 minuter</code> - Fristående tidsangivelse</li>
                        </ul>
                    </div>

                    <div className="rule-card">
                        <h3>Manuella Timers (Förslag)</h3>
                        <p>Vissa instruktioner är otydliga men antyder att en timer behövs. Dessa skapar en förslagen timer (default 10 min) som du kan justera:</p>
                        <ul>
                            <li><code>"Koka enligt förpackningen"</code></li>
                            <li><code>"Se anvisning"</code></li>
                        </ul>
                    </div>
                </section>

                <section className="doc-section">
                    <h2>⚖️ Enhetskonvertering & Matvarelogik</h2>
                    <p>För att ge exakta näringsvärden och tydliga instruktioner (dl/g) använder vi en utökad matvarudatabas.</p>

                    <div className="rule-card">
                        <h3>Basvaror (Staples)</h3>
                        <p>Vissa varor har extra data för densitet och portionsstorlek:</p>
                        <table className="doc-table">
                            <thead>
                                <tr>
                                    <th>Vara</th>
                                    <th>Portion</th>
                                    <th>Densitet</th>
                                    <th>Kokt vs Okokt</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr>
                                    <td>Ris</td>
                                    <td>70g (okokt)</td>
                                    <td>85g / dl</td>
                                    <td>Växer 2.5x vid kokning</td>
                                </tr>
                                <tr>
                                    <td>Pasta</td>
                                    <td>75g (okokt)</td>
                                    <td>35g / dl</td>
                                    <td>Växer 2.2x vid kokning</td>
                                </tr>
                                <tr>
                                    <td>Havregryn</td>
                                    <td>40g</td>
                                    <td>40g / dl</td>
                                    <td>Cooked yield: 1x (gröt hanteras separat)</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>

                    <div className="rule-card">
                        <h3>Display-regler</h3>
                        <p>Om en ingrediens anges i <code>port</code> och vi har data:</p>
                        <p><em>Exempel:</em> <code>4 port ris</code> ➔ <code>4 port (3.3 dl / 280g)</code></p>
                    </div>
                </section>

                <section className="doc-section">
                    <h2>🛠 Bygg Egna Regler (Kommande)</h2>
                    <p>Här kommer du kunna definiera egna parsningregler och enhetskonverteringar via JSON.</p>
                    <pre className="code-block">
                        {`{
  "customUnit": {
    "name": "näve",
    "grams": 30
  },
  "timerPattern": {
    "regex": "vila \\\\d+ min",
    "action": "createTimer"
  }
}`}
                    </pre>
                </section>
            </main>
        </div>
    );
}
