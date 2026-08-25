// Integração melhorada: formulário de contato salva leads no Firebase
(function () {
  if (window.ContactFirebase) return;

  async function saveLead(leadData) {
    try {
      await window.FirebaseDB.ready;
      if (!window.FirebaseDB.enabled || !firebase.apps.length) {
        console.warn('Firebase não está disponível. Lead será salvo apenas localmente.');
        return false;
      }

      const leadsRef = firebase.firestore().collection('edina').doc('leads');
      const snap = await leadsRef.get();
      const currentLeads = snap.exists ? (snap.data().data || []) : [];

      const newLead = {
        id: Math.max(0, ...currentLeads.map(l => l.id || 0)) + 1,
        ...leadData,
        createdAt: new Date().toISOString(),
        status: 'novo',
        stage: 'novo',
        assignedTo: 'não atribuído'
      };

      currentLeads.push(newLead);
      await leadsRef.set({ data: currentLeads, updatedAt: Date.now() });

      // Também salva uma notificação em tempo real (para CRM ver imediatamente)
      await firebase.firestore().collection('edina_notifications').add({
        type: 'new_lead',
        leadId: newLead.id,
        name: newLead.name,
        timestamp: Date.now()
      });

      return true;
    } catch (error) {
      console.error('Erro ao salvar lead no Firebase:', error);
      return false;
    }
  }

  window.ContactFirebase = {
    saveLead: saveLead
  };
})();
