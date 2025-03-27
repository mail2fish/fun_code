import React from 'react';
import { Provider } from 'react-redux';
import GUI from 'scratch-gui';
import store from './store';
// import 'scratch-gui/dist/scratch-gui.css';
import './App.css';

const App = () => {
  return (
    <Provider store={store}>
      <div className="scratch-editor" style={{ height: '100vh' }}>
        <GUI
          canSave={true}
          canCreateNew={true}
          canEditTitle={true}
          enableCommunity={false}
          showComingSoon={false}
        />
      </div>
    </Provider>
  );
};

export default App;