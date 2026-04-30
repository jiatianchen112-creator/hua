/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { InteractiveCanvas } from './components/InteractiveCanvas';

export default function App() {
  return (
    <div className="w-screen h-screen m-0 p-0 overflow-hidden bg-black">
      <InteractiveCanvas />
    </div>
  );
}
