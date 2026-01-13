import React, { useState, useRef, useEffect } from 'react';

function NewTaskForm({ onSubmit, onClose }) {
    const [description, setDescription] = useState('');
    const textareaRef = useRef(null);

    useEffect(() => {
        textareaRef.current?.focus();
    }, []);

    const handleSubmit = (e) => {
        e.preventDefault();
        if (description.trim()) {
            onSubmit(description.trim());
        }
    };

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal" onClick={e => e.stopPropagation()}>
                <form onSubmit={handleSubmit}>
                    <textarea
                        ref={textareaRef}
                        className="task-input"
                        placeholder="What's next?"
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        rows={3}
                    />

                    <button
                        type="submit"
                        className="btn-primary"
                        disabled={!description.trim()}
                    >
                        Start
                    </button>
                </form>
            </div>
        </div>
    );
}

export default NewTaskForm;
